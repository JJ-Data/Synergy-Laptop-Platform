import { supabaseBrowser } from "@/lib/supabase/client";
import { toast } from "sonner";

const supabase = supabaseBrowser();

export interface InvitationPayload {
  email: string;
  role: "admin" | "employee";
  companyId: string;
  companyName: string;
  inviterName: string;
}

export class InvitationService {
  static async createInvitation(payload: InvitationPayload) {
    try {
      // Create invitation record
      const { data: invitation, error } = await supabase
        .from("invitations")
        .insert({
          email: payload.email,
          role: payload.role,
          company_id: payload.companyId,
          created_by: (await supabase.auth.getUser()).data.user?.id,
          token: crypto.randomUUID(),
          expires_at: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Generate invitation link
      const inviteLink = `${window.location.origin}/accept-invite?token=${invitation.token}`;

      // Try to send email (but don't fail if it doesn't work)
      try {
        await this.sendInvitationEmail(payload, invitation.token);
        return { success: true, invitation, inviteLink, emailSent: true };
      } catch (emailError) {
        console.warn("Email sending failed, providing manual link", emailError);
        return { success: true, invitation, inviteLink, emailSent: false };
      }
    } catch (error) {
      console.error("Failed to create invitation:", error);
      throw error;
    }
  }

  static async sendInvitationEmail(payload: InvitationPayload, token: string) {
    // For now, we'll use a simple mailto link as backup
    // Later you can implement proper email service
    const subject = `Invitation to join ${payload.companyName}`;
    const body = `
Hello,

You've been invited to join ${payload.companyName} as ${
      payload.role === "admin" ? "an administrator" : "an employee"
    }.

Click here to accept: ${window.location.origin}/accept-invite?token=${token}

This invitation will expire in 7 days.

Best regards,
${payload.inviterName}
    `.trim();

    // Try Supabase Edge Function first
    const { error } = await supabase.functions.invoke("send-invitation-email", {
      body: {
        to: payload.email,
        subject,
        body,
        html: this.generateEmailHTML(payload, token),
      },
    });

    if (error) {
      // Fallback to mailto
      window.open(
        `mailto:${payload.email}?subject=${encodeURIComponent(
          subject
        )}&body=${encodeURIComponent(body)}`
      );
      throw new Error("Email service unavailable, opened mail client instead");
    }
  }

  static generateEmailHTML(payload: InvitationPayload, token: string): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background: #f9f9f9; }
            .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>You're Invited!</h1>
            </div>
            <div class="content">
              <p>Hello,</p>
              <p>You've been invited to join <strong>${
                payload.companyName
              }</strong> as ${
      payload.role === "admin" ? "an administrator" : "an employee"
    }.</p>
              <center>
                <a href="${
                  window.location.origin
                }/accept-invite?token=${token}" class="button">Accept Invitation</a>
              </center>
              <p><small>This invitation will expire in 7 days. If the button doesn't work, copy this link: ${
                window.location.origin
              }/accept-invite?token=${token}</small></p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  static async validateInvitation(token: string) {
    const { data, error } = await supabase
      .from("invitations")
      .select(
        `
        *,
        companies(name)
      `
      )
      .eq("token", token)
      .single();

    if (error || !data) {
      return { valid: false, error: "Invalid invitation token" };
    }

    if (new Date(data.expires_at) < new Date()) {
      return { valid: false, error: "Invitation has expired" };
    }

    if (data.accepted_at) {
      return { valid: false, error: "Invitation has already been used" };
    }

    return {
      valid: true,
      invitation: data,
      companyName: data.companies?.name,
    };
  }

  static async acceptInvitation(token: string, userId: string) {
    const { data: invitation, error } = await supabase
      .from("invitations")
      .update({
        accepted_at: new Date().toISOString(),
        accepted_by: userId,
      })
      .eq("token", token)
      .select()
      .single();

    if (error) throw error;

    // Create user role
    const { error: roleError } = await supabase.from("user_roles").insert({
      user_id: userId,
      role: invitation.role,
      company_id: invitation.company_id,
    });

    if (roleError) throw roleError;

    // Update user profile with company
    await supabase
      .from("profiles")
      .update({ company_id: invitation.company_id })
      .eq("id", userId);

    return { success: true };
  }
}

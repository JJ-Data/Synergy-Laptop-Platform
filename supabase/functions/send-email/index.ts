import { createClient } from "npm:@supabase/supabase-js@2.39.3";

// ZeptoMail Email Sender Edge Function
Deno.serve(async (req: Request) => {
  // Enable CORS
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders,
    });
  }

  try {
    // Validate request is POST
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Parse request body
    const {
      to,
      subject,
      body,
      from = "noreply@mustardhr.ng",
      fromName = "Mustard HR",
    } = await req.json();

    // Validate required fields
    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: to, subject, or body",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // ZeptoMail API configuration
    const ZEPTOMAIL_HOST = "api.zeptomail.com";
    const ZEPTOMAIL_TOKEN = Deno.env.get("ZEPTOMAIL_TOKEN");
    const MAIL_AGENT_ALIAS = "34ec545380b1cd9e";

    if (!ZEPTOMAIL_TOKEN) {
      throw new Error("ZeptoMail token not configured");
    }

    // Prepare email payload
    const emailPayload = {
      mail_to: [{ email: to }],
      mail_from: {
        email: from,
        name: fromName,
      },
      subject: subject,
      htmlbody: body,
      from_alias: MAIL_AGENT_ALIAS,
    };

    // Send email via ZeptoMail API
    const response = await fetch(
      `https://${ZEPTOMAIL_HOST}/v1.1/email/template`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Zoho-enczapikey ${ZEPTOMAIL_TOKEN}`,
        },
        body: JSON.stringify(emailPayload),
      }
    );

    // Handle ZeptoMail API response
    const responseData = await response.json();

    if (!response.ok) {
      return new Response(
        JSON.stringify({
          error: "Email sending failed",
          details: responseData,
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Successful email sending
    return new Response(
      JSON.stringify({
        message: "Email sent successfully",
        details: responseData,
      }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error) {
    console.error("Email sending error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

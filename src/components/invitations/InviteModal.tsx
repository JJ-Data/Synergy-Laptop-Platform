import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Copy, Mail, Users, Loader2, CheckCircle } from "lucide-react";
import { InvitationService } from "@/services/invitationService";

const schema = z.object({
  email: z.string().email("Invalid email address"),
});

const bulkSchema = z.object({
  emails: z.string().min(1, "Please enter at least one email"),
});

interface InviteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  companyName: string;
  role: "admin" | "employee";
  inviterName: string;
}

export const InviteModal = ({
  open,
  onOpenChange,
  companyId,
  companyName,
  role,
  inviterName,
}: InviteModalProps) => {
  const [activeTab, setActiveTab] = useState("single");
  const [inviteResult, setInviteResult] = useState<{
    link?: string;
    emailSent?: boolean;
  } | null>(null);

  const singleForm = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const bulkForm = useForm({
    resolver: zodResolver(bulkSchema),
    defaultValues: { emails: "" },
  });

  const handleSingleInvite = async (data: z.infer<typeof schema>) => {
    try {
      const result = await InvitationService.createInvitation({
        email: data.email,
        role,
        companyId,
        companyName,
        inviterName,
      });

      setInviteResult({
        link: result.inviteLink,
        emailSent: result.emailSent,
      });

      if (result.emailSent) {
        toast.success("Invitation sent successfully!");
      } else {
        toast.warning("Invitation created. Please share the link manually.");
      }
    } catch (error) {
      toast.error("Failed to create invitation");
    }
  };

  const handleBulkInvite = async (data: z.infer<typeof bulkSchema>) => {
    const emails = data.emails
      .split(/[\n,;]/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    let success = 0;
    let failed = 0;

    for (const email of emails) {
      try {
        await InvitationService.createInvitation({
          email,
          role,
          companyId,
          companyName,
          inviterName,
        });
        success++;
      } catch {
        failed++;
      }
    }

    toast.success(
      `Sent ${success} invitations${failed > 0 ? `, ${failed} failed` : ""}`
    );
    onOpenChange(false);
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Invite {role === "admin" ? "Admin" : "Employee"}
          </DialogTitle>
          <DialogDescription>
            Send invitations to join {companyName}
          </DialogDescription>
        </DialogHeader>

        {!inviteResult ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single">
                <Mail className="h-4 w-4 mr-2" />
                Single Invite
              </TabsTrigger>
              <TabsTrigger value="bulk">
                <Users className="h-4 w-4 mr-2" />
                Bulk Invite
              </TabsTrigger>
            </TabsList>

            <TabsContent value="single">
              <Form {...singleForm}>
                <form
                  onSubmit={singleForm.handleSubmit(handleSingleInvite)}
                  className="space-y-4"
                >
                  <FormField
                    control={singleForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input placeholder="user@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full">
                    Send Invitation
                  </Button>
                </form>
              </Form>
            </TabsContent>

            <TabsContent value="bulk">
              <Form {...bulkForm}>
                <form
                  onSubmit={bulkForm.handleSubmit(handleBulkInvite)}
                  className="space-y-4"
                >
                  <FormField
                    control={bulkForm.control}
                    name="emails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Addresses</FormLabel>
                        <FormControl>
                          <textarea
                            className="w-full min-h-[150px] p-3 border rounded-md"
                            placeholder="Enter emails separated by commas or new lines..."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full">
                    Send Bulk Invitations
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {inviteResult.emailSent
                  ? "Invitation email sent successfully!"
                  : "Invitation created. Share the link below:"}
              </AlertDescription>
            </Alert>

            {inviteResult.link && (
              <div className="space-y-2">
                <Label>Invitation Link</Label>
                <div className="flex gap-2">
                  <Input value={inviteResult.link} readOnly />
                  <Button
                    variant="outline"
                    onClick={() => copyToClipboard(inviteResult.link!)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setInviteResult(null);
                  singleForm.reset();
                }}
              >
                Send Another
              </Button>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

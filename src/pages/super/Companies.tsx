// src/pages/super/Companies.tsx
// Complete updated file with enhanced invitation system

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Mail,
  Copy,
  Check,
  ExternalLink,
  Clock,
  CheckCircle,
  Send,
  AlertCircle,
} from "lucide-react";

import AppLayout from "@/components/layout/AppLayout";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

const companySchema = z.object({
  name: z.string().min(2, "Name is required"),
  domain: z.string().optional().or(z.literal("")),
});

const inviteSchema = z.object({
  email: z.string().email("Invalid email address"),
  sendEmail: z.boolean().default(true),
  personalMessage: z.string().optional(),
});

type CompanyForm = z.infer<typeof companySchema>;
type InviteForm = z.infer<typeof inviteSchema>;

type InvitationWithCompany = {
  id: string;
  email: string;
  role: string;
  expires_at: string;
  created_at: string;
  accepted_at?: string;
  company_id: string;
  companies: {
    name: string;
  };
};

const Companies = () => {
  const qc = useQueryClient();
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Tables<"companies"> | null>(null);
  const [toDelete, setToDelete] = useState<Tables<"companies"> | null>(null);
  const [inviteFor, setInviteFor] = useState<Tables<"companies"> | null>(null);
  const [invitationSent, setInvitationSent] = useState(false);
  const [invitationDetails, setInvitationDetails] = useState<{
    token: string;
    link: string;
  } | null>(null);
  const [copiedItems, setCopiedItems] = useState<Set<string>>(new Set());

  const form = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: { name: "", domain: "" },
  });

  const inviteForm = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
      sendEmail: true,
      personalMessage: "",
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, domain, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Tables<"companies">[];
    },
  });

  // Fetch recent invitations
  const { data: recentInvitations } = useQuery({
    queryKey: ["recent-invitations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select(
          `
          id,
          email,
          role,
          expires_at,
          created_at,
          accepted_at,
          company_id,
          companies:company_id (
            name
          )
        `
        )
        .eq("role", "admin")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as InvitationWithCompany[];
    },
  });

  const upsertMutation = useMutation({
    mutationFn: async (
      payload: TablesInsert<"companies"> & { id?: string }
    ) => {
      if (payload.id) {
        const { id, ...update } = payload;
        const { error } = await supabase
          .from("companies")
          .update(update)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("companies")
          .insert([{ name: payload.name!, domain: payload.domain || null }]);
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Company saved");
      setOpenForm(false);
      setEditing(null);
      form.reset({ name: "", domain: "" });
    },
    onError: (e: any) => toast.error(e.message || "Failed to save company"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Company deleted");
      setToDelete(null);
    },
    onError: (e: any) => toast.error(e.message || "Failed to delete company"),
  });

  // Enhanced invitation mutation with email support
  const inviteMutation = useMutation({
    mutationFn: async (data: InviteForm) => {
      if (!inviteFor) throw new Error("No company selected");

      // Create invitation
      const { data: token, error } = await supabase.rpc("create_invitation", {
        _email: data.email,
        _role: "admin",
        _company_id: inviteFor.id,
      });

      if (error) throw error;

      const invitationLink = `${window.location.origin}/accept-invite?token=${token}`;

      // Send email if requested
      if (data.sendEmail) {
        try {
          const { data: emailResult, error: emailError } =
            await supabase.functions.invoke("send-email", {
              body: {
                email: data.email,
                token,
                companyName: inviteFor.name,
                inviterName: "Super Admin", // You can get this from user context
                personalMessage: data.personalMessage,
              },
            });

          if (emailError) {
            console.warn("Email sending failed:", emailError);
            toast.warning(
              "Invitation created but email sending failed. Please share the link manually."
            );
          }
        } catch (emailErr) {
          console.warn("Email service unavailable:", emailErr);
          toast.warning(
            "Invitation created but email service unavailable. Please share the link manually."
          );
        }
      }

      return { token, link: invitationLink };
    },
    onSuccess: (data) => {
      setInvitationDetails(data);
      setInvitationSent(true);
      qc.invalidateQueries({ queryKey: ["recent-invitations"] });

      if (inviteForm.watch("sendEmail")) {
        toast.success("Invitation sent successfully!");
      } else {
        toast.success("Invitation created successfully!");
      }
    },
    onError: (error) => {
      toast.error("Failed to create invitation: " + error.message);
    },
  });

  const copyToClipboard = async (text: string, itemId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItems((prev) => new Set([...prev, itemId]));
      toast.success("Copied to clipboard!");

      // Remove from copied items after 2 seconds
      setTimeout(() => {
        setCopiedItems((prev) => {
          const newSet = new Set(prev);
          newSet.delete(itemId);
          return newSet;
        });
      }, 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const startCreate = () => {
    setEditing(null);
    form.reset({ name: "", domain: "" });
    setOpenForm(true);
  };

  const startEdit = (c: Tables<"companies">) => {
    setEditing(c);
    form.reset({ name: c.name, domain: c.domain ?? "" });
    setOpenForm(true);
  };

  const startInvite = (company: Tables<"companies">) => {
    setInviteFor(company);
    setInvitationSent(false);
    setInvitationDetails(null);
    inviteForm.reset({
      email: "",
      sendEmail: true,
      personalMessage: "",
    });
  };

  const closeInviteDialog = () => {
    setInviteFor(null);
    setInvitationSent(false);
    setInvitationDetails(null);
    inviteForm.reset();
  };

  const onSubmit = (values: CompanyForm) => {
    const payload: TablesInsert<"companies"> & { id?: string } = {
      name: values.name,
      domain: values.domain || null,
      id: editing?.id,
    } as any;
    upsertMutation.mutate(payload);
  };

  const onInviteSubmit = (values: InviteForm) => {
    inviteMutation.mutate(values);
  };

  const getInvitationStatus = (invitation: InvitationWithCompany) => {
    const now = new Date();
    const expiresAt = new Date(invitation.expires_at);

    if (invitation.accepted_at) {
      return {
        status: "accepted",
        color: "bg-green-100 text-green-800",
        icon: CheckCircle,
      };
    } else if (now > expiresAt) {
      return {
        status: "expired",
        color: "bg-red-100 text-red-800",
        icon: Clock,
      };
    } else {
      return {
        status: "pending",
        color: "bg-yellow-100 text-yellow-800",
        icon: Clock,
      };
    }
  };

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <AppLayout title="Companies">
      <Seo
        title="Companies | Super Admin"
        description="Manage tenant companies in the multi-tenant laptop financing platform."
        canonical="/super/companies"
      />

      <div className="space-y-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Company Management</h1>
            <p className="text-muted-foreground">
              Create companies and assign administrators
            </p>
          </div>
          <Button onClick={startCreate} variant="hero">
            <Plus className="mr-2 h-4 w-4" /> New Company
          </Button>
        </header>

        <Tabs defaultValue="companies" className="space-y-6">
          <TabsList>
            <TabsTrigger value="companies">Companies</TabsTrigger>
            <TabsTrigger value="invitations">Recent Invitations</TabsTrigger>
          </TabsList>

          <TabsContent value="companies">
            <Card>
              <CardHeader>
                <CardTitle>Company Directory</CardTitle>
                <CardDescription>
                  Manage tenant companies and their administrators
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading companies...
                  </div>
                ) : data?.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground mb-4">
                      No companies yet
                    </p>
                    <Button onClick={startCreate} variant="hero">
                      <Plus className="mr-2 h-4 w-4" /> Create First Company
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Company</TableHead>
                        <TableHead>Domain</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="font-medium">{c.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {c.id.slice(0, 8)}...
                            </div>
                          </TableCell>
                          <TableCell>
                            {c.domain ? (
                              <Badge variant="outline">{c.domain}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {new Date(c.created_at as any).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => startInvite(c)}
                              >
                                <Mail className="mr-2 h-4 w-4" />
                                Invite Admin
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => startEdit(c)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setToDelete(c)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invitations">
            <Card>
              <CardHeader>
                <CardTitle>Recent Admin Invitations</CardTitle>
                <CardDescription>
                  Track invitations sent to company administrators
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentInvitations?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No invitations sent yet
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentInvitations?.map((invitation) => {
                      const statusInfo = getInvitationStatus(invitation);
                      const StatusIcon = statusInfo.icon;

                      return (
                        <div
                          key={invitation.id}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-4">
                            <StatusIcon className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <div className="font-medium">
                                {invitation.email}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {invitation.companies.name} • Sent{" "}
                                {new Date(
                                  invitation.created_at
                                ).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className={statusInfo.color}>
                              {statusInfo.status}
                            </Badge>
                            {statusInfo.status === "pending" && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const inviteLink = `${origin}/accept-invite?token=${invitation.id}`;
                                  copyToClipboard(inviteLink, invitation.id);
                                }}
                              >
                                {copiedItems.has(invitation.id) ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Enhanced Invite Dialog */}
      <Dialog
        open={!!inviteFor}
        onOpenChange={(open) => !open && closeInviteDialog()}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {invitationSent
                ? "Invitation Sent!"
                : "Invite Company Administrator"}
            </DialogTitle>
            <DialogDescription>
              {invitationSent
                ? `Admin invitation for ${inviteFor?.name} has been processed`
                : `Send an invitation to assign an admin for ${inviteFor?.name}`}
            </DialogDescription>
          </DialogHeader>

          {!invitationSent ? (
            <Form {...inviteForm}>
              <form
                onSubmit={inviteForm.handleSubmit(onInviteSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={inviteForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Administrator Email</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="admin@company.com"
                          {...field}
                          disabled={inviteMutation.isPending}
                        />
                      </FormControl>
                      <FormDescription>
                        The person will receive admin access to{" "}
                        {inviteFor?.name}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={inviteForm.control}
                  name="sendEmail"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Send email invitation</FormLabel>
                        <FormDescription>
                          Automatically send invitation email with setup
                          instructions
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {inviteForm.watch("sendEmail") && (
                  <FormField
                    control={inviteForm.control}
                    name="personalMessage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Personal Message (Optional)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Welcome to the team! Let me know if you need help."
                            {...field}
                            disabled={inviteMutation.isPending}
                          />
                        </FormControl>
                        <FormDescription>
                          Add a personal note to the invitation email
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                )}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={closeInviteDialog}
                    disabled={inviteMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={inviteMutation.isPending}>
                    {inviteMutation.isPending ? (
                      <>Creating...</>
                    ) : inviteForm.watch("sendEmail") ? (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Send Invitation
                      </>
                    ) : (
                      "Create Invitation"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          ) : (
            <InvitationSuccess
              details={invitationDetails!}
              companyName={inviteFor?.name || ""}
              emailSent={inviteForm.getValues("sendEmail")}
              copyToClipboard={copyToClipboard}
              copiedItems={copiedItems}
              onClose={closeInviteDialog}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Company Form Dialog */}
      <Dialog open={openForm} onOpenChange={setOpenForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Company" : "New Company"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update company details."
                : "Create a new tenant company."}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Corp" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="domain"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Domain (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="acme.com" {...field} />
                    </FormControl>
                    <FormDescription>
                      Used for SSO/email matching. You can leave this blank.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpenForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={upsertMutation.isPending}>
                  {upsertMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete company?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{toDelete?.name}</strong> and
              all related data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && deleteMutation.mutate(toDelete.id!)}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete Company
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

// Success component
const InvitationSuccess: React.FC<{
  details: { token: string; link: string };
  companyName: string;
  emailSent: boolean;
  copyToClipboard: (text: string, itemId: string) => void;
  copiedItems: Set<string>;
  onClose: () => void;
}> = ({
  details,
  companyName,
  emailSent,
  copyToClipboard,
  copiedItems,
  onClose,
}) => (
  <div className="space-y-6">
    <div className="text-center">
      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        {emailSent ? (
          <Mail className="h-6 w-6 text-green-600" />
        ) : (
          <Check className="h-6 w-6 text-green-600" />
        )}
      </div>
      <h3 className="text-lg font-semibold">
        {emailSent ? "Email Sent!" : "Invitation Ready!"}
      </h3>
      <p className="text-muted-foreground mt-1">
        {emailSent
          ? `Admin invitation email has been sent for ${companyName}`
          : `Admin invitation for ${companyName} is ready to share`}
      </p>
    </div>

    {emailSent && (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex gap-3">
          <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-green-900">
              Email delivered
            </p>
            <p className="text-sm text-green-700 mt-1">
              The administrator will receive setup instructions and can accept
              the invitation directly from their email.
            </p>
          </div>
        </div>
      </div>
    )}

    <div>
      <Label className="text-sm font-medium">Backup invitation link</Label>
      <div className="flex gap-2 mt-1">
        <Input readOnly value={details.link} className="font-mono text-sm" />
        <Button
          variant="outline"
          onClick={() => copyToClipboard(details.link, "link")}
          className="flex-shrink-0"
        >
          {copiedItems.has("link") ? (
            <Check className="h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        {emailSent
          ? "Share this as backup if email delivery fails"
          : "Share this link with the administrator"}
      </p>
    </div>

    <DialogFooter>
      <Button onClick={onClose} className="w-full">
        Done
      </Button>
    </DialogFooter>
  </div>
);

export default Companies;

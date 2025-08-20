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
  CheckCircle,
  AlertCircle,
  Loader2,
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { EmailService, createInvitationLink } from "@/lib/email";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

const companySchema = z.object({
  name: z.string().min(2, "Name is required"),
  domain: z.string().optional().or(z.literal("")),
});

type CompanyForm = z.infer<typeof companySchema>;

interface InviteState {
  step: "form" | "sending" | "success" | "fallback";
  token?: string;
  emailSent?: boolean;
  error?: string;
}

const Companies = () => {
  const qc = useQueryClient();
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Tables<"companies"> | null>(null);
  const [toDelete, setToDelete] = useState<Tables<"companies"> | null>(null);
  const [inviteFor, setInviteFor] = useState<Tables<"companies"> | null>(null);
  const [inviteState, setInviteState] = useState<InviteState>({ step: "form" });

  const form = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: { name: "", domain: "" },
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

  const inviteMutation = useMutation({
    mutationFn: async ({
      email,
      companyId,
      companyName,
    }: {
      email: string;
      companyId: string;
      companyName: string;
    }) => {
      // Create invitation in database
      const { data: token, error } = await supabase.rpc("create_invitation", {
        _email: email,
        _role: "admin",
        _company_id: companyId,
      });

      if (error) throw error;

      // Try to send email
      const inviteLink = createInvitationLink(token as string);

      try {
        const emailSent = await EmailService.sendInvitation({
          inviteLink,
          companyName,
          role: "Company Admin",
          inviterName: "Super Admin", // You could get this from user context
          expiresAt: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(), // 7 days
        });

        return { token: token as string, emailSent, inviteLink };
      } catch (emailError) {
        console.warn(
          "Email sending failed, but invitation was created:",
          emailError
        );
        return { token: token as string, emailSent: false, inviteLink };
      }
    },
    onSuccess: ({ token, emailSent, inviteLink }) => {
      setInviteState({
        step: emailSent ? "success" : "fallback",
        token,
        emailSent,
      });

      if (emailSent) {
        toast.success("Invitation sent successfully!");
      } else {
        toast.warning(
          "Invitation created, but email failed to send. Please share the link manually."
        );
      }
    },
    onError: (e: any) => {
      setInviteState({ step: "form", error: e.message });
      toast.error(e.message || "Failed to create invitation");
    },
  });

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

  const onSubmit = (values: CompanyForm) => {
    const payload: TablesInsert<"companies"> & { id?: string } = {
      name: values.name,
      domain: values.domain || null,
      id: editing?.id,
    } as any;
    upsertMutation.mutate(payload);
  };

  const resetInviteDialog = () => {
    setInviteFor(null);
    setInviteState({ step: "form" });
  };

  return (
    <AppLayout title="Companies">
      <Seo
        title="Companies | Super Admin"
        description="Manage tenant companies in the multi-tenant laptop financing platform."
        canonical="/super/companies"
      />

      <section aria-labelledby="companies-heading" className="space-y-4">
        <header className="flex items-center justify-between">
          <h2 id="companies-heading" className="sr-only">
            Companies list
          </h2>
          <Button onClick={startCreate} variant="hero">
            <Plus className="mr-2 h-4 w-4" /> New Company
          </Button>
        </header>

        <div className="rounded-md border">
          <Table>
            <TableCaption>
              {isLoading
                ? "Loading companies..."
                : data?.length
                ? `${data.length} companies`
                : "No companies yet"}
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>{c.domain ?? "—"}</TableCell>
                  <TableCell>
                    {new Date(c.created_at as any).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Dialog
                      open={inviteFor?.id === c.id}
                      onOpenChange={(o) => {
                        if (!o) resetInviteDialog();
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="subtle"
                          size="sm"
                          onClick={() => setInviteFor(c)}
                        >
                          <Mail className="mr-2 h-4 w-4" /> Invite Admin
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Invite Admin to {c.name}</DialogTitle>
                          <DialogDescription>
                            Send an invitation to assign an admin for this
                            company.
                          </DialogDescription>
                        </DialogHeader>

                        <InviteDialogContent
                          company={c}
                          state={inviteState}
                          onInvite={(email) => {
                            setInviteState({ step: "sending" });
                            inviteMutation.mutate({
                              email,
                              companyId: c.id,
                              companyName: c.name,
                            });
                          }}
                        />

                        <DialogFooter>
                          <Button variant="outline" onClick={resetInviteDialog}>
                            {inviteState.step === "success" ? "Done" : "Close"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(c)}
                    >
                      <Pencil className="mr-2 h-4 w-4" /> Edit
                    </Button>

                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setToDelete(c)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

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
              This will permanently remove the company and related data. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && deleteMutation.mutate(toDelete.id!)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

// Separate component for invite dialog content
function InviteDialogContent({
  company,
  state,
  onInvite,
}: {
  company: Tables<"companies">;
  state: InviteState;
  onInvite: (email: string) => void;
}) {
  const [email, setEmail] = useState("");

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  if (state.step === "sending") {
    return (
      <div className="flex items-center gap-3 p-4">
        <Loader2 className="h-5 w-5 animate-spin" />
        <div>
          <p className="font-medium">Creating invitation...</p>
          <p className="text-sm text-muted-foreground">
            This may take a moment
          </p>
        </div>
      </div>
    );
  }

  if (state.step === "success") {
    const inviteLink = createInvitationLink(state.token!);
    return (
      <div className="space-y-4">
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            Invitation email sent successfully! The admin will receive an email
            with instructions to join.
          </AlertDescription>
        </Alert>

        <div>
          <Label>Backup - Invitation Link</Label>
          <div className="flex gap-2 mt-1">
            <Input readOnly value={inviteLink} className="text-sm" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(inviteLink)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Share this link if the email doesn't arrive
          </p>
        </div>
      </div>
    );
  }

  if (state.step === "fallback") {
    const inviteLink = createInvitationLink(state.token!);
    return (
      <div className="space-y-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Invitation created, but email delivery failed. Please share the link
            below manually.
          </AlertDescription>
        </Alert>

        <div>
          <Label>Invitation Link</Label>
          <div className="flex gap-2 mt-1">
            <Input readOnly value={inviteLink} className="text-sm" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(inviteLink)}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Send this link to the admin via your preferred communication method
          </p>
        </div>
      </div>
    );
  }

  // Default form step
  return (
    <div className="space-y-4">
      {state.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="invite-email">Admin Email</Label>
        <Input
          id="invite-email"
          type="email"
          placeholder="admin@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <Button
        onClick={() => onInvite(email)}
        disabled={!email || !email.includes("@")}
        className="w-full"
      >
        Send Invitation Email
      </Button>

      <p className="text-xs text-muted-foreground">
        An email will be sent with invitation instructions. If email fails,
        you'll get a manual link to share.
      </p>
    </div>
  );
}

export default Companies;

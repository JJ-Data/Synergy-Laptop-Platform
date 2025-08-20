// Updated src/pages/super/Companies.tsx
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Mail, Copy, Loader2 } from "lucide-react";

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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

const companySchema = z.object({
  name: z.string().min(2, "Name is required"),
  domain: z.string().optional().or(z.literal("")),
});

type CompanyForm = z.infer<typeof companySchema>;

const Companies = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<Tables<"companies"> | null>(null);
  const [toDelete, setToDelete] = useState<Tables<"companies"> | null>(null);
  const [inviteFor, setInviteFor] = useState<Tables<"companies"> | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);

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

  // Enhanced invite mutation with email sending
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
      // Step 1: Create invitation in database
      const { data: token, error: inviteError } = await supabase.rpc(
        "create_invitation",
        {
          _email: email,
          _role: "admin",
          _company_id: companyId,
        }
      );

      if (inviteError) throw inviteError;

      // Step 2: Send email via Edge Function
      const { data: functionData, error: functionError } =
        await supabase.functions.invoke("send-invitation-email", {
          body: {
            email: email,
            token: token,
            companyName: companyName,
            role: "admin",
            inviterName: user?.name || user?.email || "Super Administrator",
          },
        });

      if (functionError) {
        console.error("Email function error:", functionError);
        // Even if email fails, we still created the invitation
        // So we'll show a warning and return the token for manual sharing
        toast.warning(
          `Invitation created but email failed to send. You can share this link manually: ${window.location.origin}/accept-invite?token=${token}`
        );
        return { token, emailSent: false };
      }

      return { token, emailSent: true, functionData };
    },
    onSuccess: (result) => {
      setInviteToken(result.token);
      if (result.emailSent) {
        toast.success(
          "Admin invitation sent successfully! They will receive an email with instructions."
        );
      }
    },
    onError: (e: any) => {
      console.error("Invitation error:", e);
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
                        if (!o) {
                          setInviteFor(null);
                          setInviteToken(null);
                        }
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
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Invite Admin to {c.name}</DialogTitle>
                          <DialogDescription>
                            Send an email invitation to assign an admin for this
                            company.
                          </DialogDescription>
                        </DialogHeader>
                        {!inviteToken ? (
                          <InviteForm
                            onSubmit={(email) =>
                              inviteMutation.mutate({
                                email,
                                companyId: c.id,
                                companyName: c.name,
                              })
                            }
                            loading={inviteMutation.isPending}
                          />
                        ) : (
                          <InviteResult token={inviteToken} />
                        )}
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setInviteFor(null);
                              setInviteToken(null);
                            }}
                          >
                            Close
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

function InviteForm({
  onSubmit,
  loading,
}: {
  onSubmit: (email: string) => void;
  loading: boolean;
}) {
  const [email, setEmail] = useState("");
  return (
    <div className="space-y-4">
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
        onClick={() => onSubmit(email)}
        disabled={!email || loading}
        className="flex items-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending Invitation...
          </>
        ) : (
          <>
            <Mail className="h-4 w-4" />
            Send Email Invitation
          </>
        )}
      </Button>
    </div>
  );
}

function InviteResult({ token }: { token: string }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = `${origin}/accept-invite?token=${token}`;
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };
  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-green-50 border border-green-200 p-4">
        <h4 className="text-green-800 font-medium mb-2">
          ✅ Invitation Sent Successfully!
        </h4>
        <p className="text-green-700 text-sm">
          The admin will receive an email with instructions to accept the
          invitation. You can also share the backup information below if needed.
        </p>
      </div>

      <div>
        <Label>Backup Token</Label>
        <div className="flex gap-2 mt-1">
          <Input readOnly value={token} aria-label="Invitation token" />
          <Button variant="outline" type="button" onClick={() => copy(token)}>
            <Copy className="mr-2 h-4 w-4" /> Copy
          </Button>
        </div>
      </div>
      <div>
        <Label>Backup Link</Label>
        <div className="flex gap-2 mt-1">
          <Input readOnly value={link} aria-label="Invitation link" />
          <Button variant="outline" type="button" onClick={() => copy(link)}>
            <Copy className="mr-2 h-4 w-4" /> Copy
          </Button>
        </div>
      </div>
    </div>
  );
}

export default Companies;

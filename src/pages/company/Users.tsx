import AppLayout from "@/components/layout/AppLayout";
import Seo from "@/components/seo/Seo";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/context/CompanyContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Search,
  UserPlus,
  User,
  Building,
  Mail,
  Copy,
  CheckCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { EmailService, createInvitationLink } from "@/lib/email";

type CompanyUser = {
  id: string;
  email: string;
  display_name?: string;
  role: string;
  created_at: string;
};

const inviteSchema = z.object({
  email: z.string().email("Invalid email address"),
});

interface InviteState {
  step: "form" | "sending" | "success" | "fallback";
  token?: string;
  emailSent?: boolean;
  error?: string;
}

const Users = () => {
  const { companyId, company } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteState, setInviteState] = useState<InviteState>({ step: "form" });
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
    },
  });

  // Fetch company users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["company-users", companyId, searchTerm],
    queryFn: async () => {
      if (!companyId) return [];

      try {
        // Get user roles for this company
        const { data: userRoles, error: rolesError } = await supabase
          .from("user_roles")
          .select("user_id, role")
          .eq("company_id", companyId);

        if (rolesError) throw rolesError;

        if (!userRoles?.length) return [];

        // Get profiles for these users
        const userIds = userRoles.map((r) => r.user_id);
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, display_name, created_at")
          .in("id", userIds);

        if (profilesError) {
          console.warn(
            "Could not fetch profiles due to RLS restrictions:",
            profilesError
          );
          // Continue without profiles if RLS blocks access
        }

        // Try to get auth users for email addresses (this might also fail due to RLS)
        let authUsers: any[] = [];
        try {
          const { data: authData, error: authError } =
            await supabase.auth.admin.listUsers();
          if (authError) throw authError;
          authUsers = authData.users;
        } catch (authError) {
          console.warn(
            "Could not fetch auth users, using fallback:",
            authError
          );
          // Create placeholder data
        }

        // Combine the data
        const companyUsers: CompanyUser[] = userRoles
          .map((roleData: any) => {
            const profile = profiles?.find(
              (p: any) => p.id === roleData.user_id
            );
            const authUser = authUsers.find(
              (u: any) => u.id === roleData.user_id
            );

            return {
              id: roleData.user_id,
              email:
                authUser?.email ||
                `user-${roleData.user_id.slice(0, 8)}@unknown.com`,
              display_name: profile?.display_name || "Unknown User",
              role: roleData.role,
              created_at:
                authUser?.created_at ||
                profile?.created_at ||
                new Date().toISOString(),
            };
          })
          .filter(
            (user) =>
              searchTerm === "" ||
              user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (user.display_name &&
                user.display_name
                  .toLowerCase()
                  .includes(searchTerm.toLowerCase()))
          );

        return companyUsers;
      } catch (error) {
        console.error("Error fetching company users:", error);
        return [];
      }
    },
    enabled: !!companyId,
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: role as any })
        .eq("user_id", userId)
        .eq("company_id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-users"] });
      toast.success("Role updated successfully");
      setSelectedUser(null);
      setNewRole("");
    },
    onError: (error) => {
      toast.error("Failed to update role: " + error.message);
    },
  });

  // Invite employee mutation
  const inviteMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      if (!companyId) throw new Error("No company selected");

      // Create invitation in database
      const { data: token, error } = await supabase.rpc("create_invitation", {
        _email: email,
        _role: "employee",
        _company_id: companyId,
      });

      if (error) throw error;

      // Try to send email
      const inviteLink = createInvitationLink(token as string);

      try {
        const emailSent = await EmailService.sendInvitation({
          inviteLink,
          companyName: company?.name || "Your Company",
          role: "Employee",
          inviterName: "Company Admin", // You could get this from user context
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
    onSuccess: ({ token, emailSent }) => {
      setInviteState({
        step: emailSent ? "success" : "fallback",
        token,
        emailSent,
      });

      queryClient.invalidateQueries({ queryKey: ["company-users"] });

      if (emailSent) {
        toast.success("Invitation sent successfully!");
      } else {
        toast.warning(
          "Invitation created, but email failed to send. Please share the link manually."
        );
      }
    },
    onError: (error) => {
      setInviteState({ step: "form", error: error.message });
      toast.error("Failed to send invitation: " + error.message);
    },
  });

  const handleUpdateRole = () => {
    if (!selectedUser || !newRole) return;

    updateRoleMutation.mutate({
      userId: selectedUser,
      role: newRole,
    });
  };

  const onInviteSubmit = (values: z.infer<typeof inviteSchema>) => {
    setInviteState({ step: "sending" });
    inviteMutation.mutate({ email: values.email });
  };

  const resetInviteDialog = () => {
    setInviteDialogOpen(false);
    setInviteState({ step: "form" });
    form.reset();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "default";
      default:
        return "secondary";
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Copy failed");
    }
  };

  if (!companyId) {
    return (
      <AppLayout title="Users">
        <Seo
          title="Users | Company Admin"
          description="Manage users in your company."
        />
        <div className="text-center py-8 text-muted-foreground">
          No company context. Please log in as a company admin.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Users">
      <Seo
        title="Users | Company Admin"
        description="Manage users in your company."
      />

      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Company Users</h1>
            <p className="text-muted-foreground">
              Manage employees and admins for {company?.name}
            </p>
          </div>

          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Invite Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Invite New Employee</DialogTitle>
                <DialogDescription>
                  Send an invitation to a new employee to join your company.
                </DialogDescription>
              </DialogHeader>

              <InviteEmployeeContent
                form={form}
                state={inviteState}
                onSubmit={onInviteSubmit}
                onClose={resetInviteDialog}
              />
            </DialogContent>
          </Dialog>
        </div>

        {/* Search Bar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Users
            </CardTitle>
            <CardDescription>Search by email or display name</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Enter email or name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Company Users ({users.length})</CardTitle>
            <CardDescription>
              Employees and admins in your company
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading users...
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No users found
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {user.display_name || "No name"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {user.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={getRoleColor(user.role)}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.created_at
                          ? new Date(user.created_at).toLocaleDateString()
                          : "Unknown"}
                      </TableCell>
                      <TableCell>
                        {user.role !== "admin" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedUser(user.id)}
                            className="flex items-center gap-1"
                          >
                            <UserPlus className="h-4 w-4" />
                            Change Role
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Role Update Modal */}
        {selectedUser && (
          <Card>
            <CardHeader>
              <CardTitle>Update User Role</CardTitle>
              <CardDescription>
                Change the role for{" "}
                {users.find((u) => u.id === selectedUser)?.email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">New Role</label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Company Admin</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleUpdateRole}
                  disabled={!newRole || updateRoleMutation.isPending}
                >
                  {updateRoleMutation.isPending ? "Updating..." : "Update Role"}
                </Button>
                <Button variant="outline" onClick={() => setSelectedUser(null)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

// Separate component for invite dialog content
function InviteEmployeeContent({
  form,
  state,
  onSubmit,
  onClose,
}: {
  form: any;
  state: InviteState;
  onSubmit: (values: any) => void;
  onClose: () => void;
}) {
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
            Invitation email sent successfully! The employee will receive an
            email with instructions to join.
          </AlertDescription>
        </Alert>

        <div>
          <label className="text-sm font-medium">
            Backup - Invitation Link
          </label>
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

        <div className="flex gap-2">
          <Button onClick={onClose} className="w-full">
            Done
          </Button>
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
          <label className="text-sm font-medium">Invitation Link</label>
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
            Send this link to the employee via your preferred communication
            method
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={onClose} className="w-full">
            Done
          </Button>
        </div>
      </div>
    );
  }

  // Default form step
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {state.error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Employee Email</FormLabel>
              <FormControl>
                <Input placeholder="employee@company.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-2">
          <Button type="submit" disabled={inviteMutation.isPending}>
            {inviteMutation.isPending ? "Sending..." : "Send Invitation Email"}
          </Button>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          An email will be sent with invitation instructions. If email fails,
          you'll get a manual link to share.
        </p>
      </form>
    </Form>
  );
}

export default Users;

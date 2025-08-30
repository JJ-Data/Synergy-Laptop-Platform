// src/pages/company/Users.tsx - Fixed version without foreign key dependencies
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
  Mail,
  Shield,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Simplified user type
type CompanyUser = {
  user_id: string;
  role: string;
  created_at: string;
  display_name?: string;
  profile_created_at?: string;
};

const inviteSchema = z.object({
  email: z.string().email("Invalid email address"),
});

const Users = () => {
  const { companyId, company } = useCompany();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof inviteSchema>>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: "",
    },
  });

  // FIXED: Separate queries without foreign key dependencies
  const {
    data: users = [],
    isLoading,
    error: usersError,
  } = useQuery({
    queryKey: ["company-users", companyId, searchTerm],
    queryFn: async () => {
      if (!companyId) return [];

      console.log("Fetching users for company:", companyId);

      try {
        // Step 1: Get user roles for this company
        const { data: userRoles, error: rolesError } = await supabase
          .from("user_roles")
          .select("user_id, role, created_at")
          .eq("company_id", companyId)
          .order("created_at", { ascending: false });

        if (rolesError) {
          console.error("Error fetching user roles:", rolesError);
          throw new Error(`Failed to fetch user roles: ${rolesError.message}`);
        }

        console.log("Found user roles:", userRoles?.length || 0);

        if (!userRoles || userRoles.length === 0) {
          return [];
        }

        // Step 2: Get profile information for each user
        const userIds = userRoles.map((role) => role.user_id);

        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, display_name, created_at")
          .in("id", userIds);

        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
          // Don't throw error for profiles - we can still show users without profile info
        }

        console.log("Found profiles:", profiles?.length || 0);

        // Step 3: Combine the data
        const companyUsers: CompanyUser[] = userRoles
          .map((roleData) => {
            const profile = profiles?.find((p) => p.id === roleData.user_id);

            return {
              user_id: roleData.user_id,
              role: roleData.role,
              created_at: roleData.created_at,
              display_name: profile?.display_name,
              profile_created_at: profile?.created_at,
            };
          })
          .filter((user) => {
            if (!searchTerm) return true;
            // Search by display name or user ID
            const searchLower = searchTerm.toLowerCase();
            return (
              user.display_name?.toLowerCase().includes(searchLower) ||
              user.user_id.toLowerCase().includes(searchLower)
            );
          });

        console.log("Final processed users:", companyUsers.length);
        return companyUsers;
      } catch (error: any) {
        console.error("Error in users query:", error);
        throw error;
      }
    },
    enabled: !!companyId,
    retry: 3,
    retryDelay: 1000,
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      console.log("Updating role for user:", { userId, role, companyId });

      const { error } = await supabase
        .from("user_roles")
        .update({ role: role as any })
        .eq("user_id", userId)
        .eq("company_id", companyId);

      if (error) {
        console.error("Role update error:", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-users"] });
      toast.success("Role updated successfully");
      setSelectedUser(null);
      setNewRole("");
    },
    onError: (error: any) => {
      console.error("Role update failed:", error);
      toast.error("Failed to update role: " + error.message);
    },
  });

  // Invite employee mutation
  const inviteMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      if (!companyId) throw new Error("No company selected");

      console.log("Creating invitation for:", email, "to company:", companyId);

      const { data, error } = await supabase.rpc("create_invitation", {
        _email: email.trim(),
        _role: "employee",
        _company_id: companyId,
      });

      if (error) {
        console.error("Invitation creation error:", error);
        throw error;
      }

      console.log("Invitation created successfully:", data);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-users"] });
      toast.success("Invitation sent successfully");
      setInviteDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      console.error("Invitation failed:", error);
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
    inviteMutation.mutate({ email: values.email });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "default";
      case "employee":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "admin":
        return <Shield className="h-3 w-3" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  // Debug logging
  console.log("Users page state:", {
    companyId,
    companyName: company?.name,
    usersCount: users.length,
    isLoading,
    error: usersError?.message,
    searchTerm,
  });

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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite New Employee</DialogTitle>
                <DialogDescription>
                  Send an invitation to a new employee to join your company.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onInviteSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="employee@company.com"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={inviteMutation.isPending}>
                      {inviteMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Send Invitation"
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setInviteDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Debug info for development */}
        {process.env.NODE_ENV === "development" && (
          <Card className="border-dashed border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <details>
                <summary className="text-sm font-medium cursor-pointer">
                  Debug Info
                </summary>
                <pre className="text-xs mt-2 overflow-auto max-h-32">
                  {JSON.stringify(
                    {
                      companyId,
                      companyName: company?.name,
                      usersCount: users.length,
                      isLoading,
                      error: usersError?.message,
                      searchTerm,
                      sampleUser: users[0] || null,
                    },
                    null,
                    2
                  )}
                </pre>
              </details>
            </CardContent>
          </Card>
        )}

        {/* Error display */}
        {usersError && (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div>
                <strong>Error loading users:</strong> {usersError.message}
              </div>
              <div className="mt-2 text-xs">
                This might be due to missing database relationships or
                permissions. Check the debug info above and your Supabase logs.
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Search Bar */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Users
            </CardTitle>
            <CardDescription>Search by display name or user ID</CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              placeholder="Enter display name or user ID..."
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
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                <div className="text-muted-foreground">Loading users...</div>
              </div>
            ) : usersError ? (
              <div className="text-center py-8">
                <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-red-500 opacity-50" />
                <div className="text-red-600 font-medium">
                  Failed to load users
                </div>
                <div className="text-sm text-muted-foreground mt-2">
                  Check your database setup and permissions
                </div>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() =>
                    queryClient.invalidateQueries({
                      queryKey: ["company-users"],
                    })
                  }
                >
                  Retry
                </Button>
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? (
                  <>
                    <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <div>No users match your search</div>
                    <Button
                      variant="outline"
                      className="mt-4"
                      onClick={() => setSearchTerm("")}
                    >
                      Clear Search
                    </Button>
                  </>
                ) : (
                  <>
                    <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <div className="mb-2">No users in your company yet</div>
                    <div className="text-sm mb-4">
                      Start by inviting your first employee
                    </div>
                    <Button onClick={() => setInviteDialogOpen(true)}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Invite First User
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {user.display_name || "No name set"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              ID: {user.user_id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getRoleColor(user.role)}
                          className="flex w-fit items-center gap-1"
                        >
                          {getRoleIcon(user.role)}
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                        {user.profile_created_at && (
                          <div className="text-xs text-muted-foreground">
                            Profile:{" "}
                            {new Date(
                              user.profile_created_at
                            ).toLocaleDateString()}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.role !== "admin" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedUser(user.user_id);
                              setNewRole("admin");
                            }}
                            className="flex items-center gap-1"
                          >
                            <UserPlus className="h-4 w-4" />
                            Promote to Admin
                          </Button>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            Admin
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Role Update Confirmation */}
        {selectedUser && (
          <Card>
            <CardHeader>
              <CardTitle>Promote User to Admin</CardTitle>
              <CardDescription>
                Promote{" "}
                {users.find((u) => u.user_id === selectedUser)?.display_name ||
                  "this user"}{" "}
                to company admin?
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  This will give the user admin access to manage company
                  settings, users, and financing requests.
                </AlertDescription>
              </Alert>

              <div className="flex gap-2">
                <Button
                  onClick={handleUpdateRole}
                  disabled={updateRoleMutation.isPending}
                >
                  {updateRoleMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Promoting...
                    </>
                  ) : (
                    "Confirm Promotion"
                  )}
                </Button>
                <Button variant="outline" onClick={() => setSelectedUser(null)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Information about limitations */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-900">
                  User Management Notes
                </h3>
                <div className="text-sm text-blue-700 mt-1 space-y-1">
                  <p>
                    • Email addresses are not displayed for security reasons
                  </p>
                  <p>
                    • Users are identified by their display names and user IDs
                  </p>
                  <p>
                    • New users must accept invitation emails to join the
                    company
                  </p>
                  <p>• Only company admins can promote users to admin role</p>
                  <p>• Users without profiles will show "No name set"</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Users;

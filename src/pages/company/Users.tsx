import AppLayout from "@/components/layout/AppLayout";
import Seo from "@/components/seo/Seo";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/context/CompanyContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { toast } from "sonner";
import { Search, UserPlus, User, Mail } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

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

  // Fetch company users
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["company-users", companyId, searchTerm],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase.functions.invoke<{ users: CompanyUser[] }>("list-company-users", {
        body: { companyId }
      });
      if (error) throw error;

      const companyUsers = (data?.users || []).filter(user =>
        searchTerm === "" ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.display_name && user.display_name.toLowerCase().includes(searchTerm.toLowerCase()))
      );

      return companyUsers;
    },
    enabled: !!companyId,
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: role as Database["public"]["Enums"]["app_role"] })
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
      
      const { data, error } = await supabase.rpc("create_invitation", {
        _email: email,
        _role: "employee",
        _company_id: companyId,
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-users"] });
      toast.success("Invitation sent successfully");
      setInviteDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast.error("Failed to send invitation: " + error.message);
    },
  });

  const handleUpdateRole = () => {
    if (!selectedUser || !newRole) return;

    updateRoleMutation.mutate({
      userId: selectedUser,
      role: newRole
    });
  };

  const onInviteSubmit = (values: z.infer<typeof inviteSchema>) => {
    inviteMutation.mutate({ email: values.email });
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "default";
      default:
        return "secondary";
    }
  };

  if (!companyId) {
    return (
      <AppLayout title="Users">
        <Seo title="Users | Company Admin" description="Manage users in your company." />
        <div className="text-center py-8 text-muted-foreground">
          No company context. Please log in as a company admin.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Users">
      <Seo title="Users | Company Admin" description="Manage users in your company." />
      
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">Company Users</h1>
            <p className="text-muted-foreground">Manage employees and admins for {company?.name}</p>
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
                <form onSubmit={form.handleSubmit(onInviteSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input placeholder="employee@company.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={inviteMutation.isPending}>
                      {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              </Form>
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
            <CardDescription>Employees and admins in your company</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading users...</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No users found</div>
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
                            <div className="font-medium">{user.display_name || "No name"}</div>
                            <div className="text-sm text-muted-foreground">{user.id.slice(0, 8)}...</div>
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
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : "Unknown"}
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
                Change the role for {users.find(u => u.id === selectedUser)?.email}
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

export default Users;
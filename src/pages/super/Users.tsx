import AppLayout from "@/components/layout/AppLayout";
import Seo from "@/components/seo/Seo";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Search, UserPlus, Shield, User, Building } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type UserWithDetails = {
  id: string;
  email: string;
  display_name?: string;
  roles: Array<{
    role: string;
    company_id?: string;
    company_name?: string;
  }>;
  created_at: string;
};

const Users = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [newRole, setNewRole] = useState<string>("");
  const [newCompany, setNewCompany] = useState<string>("");
  const queryClient = useQueryClient();

  // Fetch all users with their roles and company info
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["super-admin-users", searchTerm],
    queryFn: async () => {
      // Get profiles with basic user info
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name, created_at")
        .ilike("display_name", `%${searchTerm}%`);
      
      if (profilesError) throw profilesError;

      // Get user roles with company names
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select(`
          user_id,
          role,
          company_id,
          companies:company_id (
            name
          )
        `);
      
      if (rolesError) throw rolesError;

      // Get auth users for email addresses
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      if (authError) throw authError;

      // Combine the data
      const usersWithDetails: UserWithDetails[] = authUsers.users.map(authUser => {
        const profile = profiles?.find(p => p.id === authUser.id);
        const roles = userRoles?.filter(r => r.user_id === authUser.id).map(r => ({
          role: r.role,
          company_id: r.company_id,
          company_name: r.companies?.name || 'No Company'
        })) || [];

        return {
          id: authUser.id,
          email: authUser.email || '',
          display_name: profile?.display_name,
          roles,
          created_at: authUser.created_at
        };
      }).filter(user => 
        searchTerm === "" || 
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.display_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );

      return usersWithDetails;
    },
  });

  // Fetch companies for role assignment
  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Assign role mutation
  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, role, companyId }: { userId: string; role: string; companyId?: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .insert({
          user_id: userId,
          role: role as any,
          company_id: companyId || null
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["super-admin-users"] });
      toast.success("Role assigned successfully");
      setSelectedUser(null);
      setNewRole("");
      setNewCompany("");
    },
    onError: (error) => {
      toast.error("Failed to assign role: " + error.message);
    },
  });

  const handleAssignRole = () => {
    if (!selectedUser || !newRole) return;
    
    const companyId = newRole === "super_admin" ? undefined : newCompany;
    if (newRole !== "super_admin" && !companyId) {
      toast.error("Please select a company for this role");
      return;
    }

    assignRoleMutation.mutate({
      userId: selectedUser,
      role: newRole,
      companyId
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "super_admin":
        return <Shield className="h-4 w-4" />;
      case "admin":
        return <Building className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "destructive";
      case "admin":
        return "default";
      default:
        return "secondary";
    }
  };

  return (
    <AppLayout title="Users">
      <Seo title="Users | Super Admin" description="Manage platform users and roles across all companies." />
      
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground">Search, view, and manage user roles across all companies</p>
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
            <CardTitle>Users ({users.length})</CardTitle>
            <CardDescription>All platform users and their assigned roles</CardDescription>
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
                    <TableHead>Roles</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="font-medium">{user.display_name || "No name"}</div>
                        <div className="text-sm text-muted-foreground">{user.id.slice(0, 8)}...</div>
                      </TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.length === 0 ? (
                            <Badge variant="outline">No roles</Badge>
                          ) : (
                            user.roles.map((role, index) => (
                              <Badge key={index} variant={getRoleColor(role.role)} className="flex items-center gap-1">
                                {getRoleIcon(role.role)}
                                {role.role}
                                {role.company_name && role.role !== "super_admin" && (
                                  <span className="text-xs">@ {role.company_name}</span>
                                )}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedUser(user.id)}
                          className="flex items-center gap-1"
                        >
                          <UserPlus className="h-4 w-4" />
                          Assign Role
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Role Assignment Modal */}
        {selectedUser && (
          <Card>
            <CardHeader>
              <CardTitle>Assign New Role</CardTitle>
              <CardDescription>
                Assign a new role to {users.find(u => u.id === selectedUser)?.email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Role</label>
                <Select value={newRole} onValueChange={setNewRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="admin">Company Admin</SelectItem>
                    <SelectItem value="employee">Employee</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newRole && newRole !== "super_admin" && (
                <div>
                  <label className="text-sm font-medium">Company</label>
                  <Select value={newCompany} onValueChange={setNewCompany}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companies.map((company) => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex gap-2">
                <Button 
                  onClick={handleAssignRole}
                  disabled={!newRole || (newRole !== "super_admin" && !newCompany) || assignRoleMutation.isPending}
                >
                  {assignRoleMutation.isPending ? "Assigning..." : "Assign Role"}
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

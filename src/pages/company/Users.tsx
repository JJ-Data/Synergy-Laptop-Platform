// src/pages/company/Users.tsx (Improved Version)
import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompany } from "@/context/CompanyContext";
import { useAuth } from "@/context/AuthContext";
import { UserService } from "@/services/userService";
import { InviteModal } from "@/components/invitations/InviteModal";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Search,
  UserPlus,
  MoreVertical,
  Mail,
  Shield,
  UserX,
  Activity,
  Users,
} from "lucide-react";

const CompanyUsersPage = () => {
  const { companyId, company } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteRole, setInviteRole] = useState<"admin" | "employee">(
    "employee"
  );

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["company-users", companyId],
    queryFn: () => UserService.getCompanyUsers(companyId!),
    enabled: !!companyId,
  });

  const filteredUsers = users.filter(
    (user) =>
      user.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: string }) =>
      UserService.updateUserRole(userId, companyId!, newRole),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-users"] });
      toast.success("Role updated successfully");
    },
    onError: () => toast.error("Failed to update role"),
  });

  const removeUserMutation = useMutation({
    mutationFn: (userId: string) =>
      UserService.removeUserFromCompany(userId, companyId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-users"] });
      toast.success("User removed from company");
    },
    onError: () => toast.error("Failed to remove user"),
  });

  const openInviteModal = (role: "admin" | "employee") => {
    setInviteRole(role);
    setShowInviteModal(true);
  };

  const stats = {
    total: users.length,
    admins: users.filter((u) => u.role === "admin").length,
    employees: users.filter((u) => u.role === "employee").length,
  };

  if (!companyId) {
    return (
      <AppLayout title="Users">
        <div className="text-center py-8 text-muted-foreground">
          No company context available
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="User Management">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">User Management</h1>
            <p className="text-muted-foreground">
              Manage employees and administrators for {company?.name}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => openInviteModal("admin")}>
              <Shield className="h-4 w-4 mr-2" />
              Invite Admin
            </Button>
            <Button onClick={() => openInviteModal("employee")}>
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Employee
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.admins}</p>
                  <p className="text-sm text-muted-foreground">Admins</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.employees}</p>
                  <p className="text-sm text-muted-foreground">Employees</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filter */}
        <Card>
          <CardHeader>
            <CardTitle>Search Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>
              All users with access to your company
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading users...</div>
            ) : filteredUsers.length === 0 ? (
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
                    <TableHead>Last Active</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar>
                            <AvatarImage src={user.avatarUrl} />
                            <AvatarFallback>
                              {user.displayName?.[0] || user.email?.[0] || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">
                              {user.displayName || "Unnamed User"}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              ID: {user.id.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {user.email || (
                          <span className="text-muted-foreground">
                            No email
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            user.role === "admin" ? "default" : "secondary"
                          }
                        >
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(user.joinedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {user.lastActive
                          ? new Date(user.lastActive).toLocaleDateString()
                          : "Never"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem>
                              <Activity className="h-4 w-4 mr-2" />
                              View Activity
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="h-4 w-4 mr-2" />
                              Send Message
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {user.role !== "admin" && (
                              <DropdownMenuItem
                                onClick={() =>
                                  updateRoleMutation.mutate({
                                    userId: user.id,
                                    newRole: "admin",
                                  })
                                }
                              >
                                <Shield className="h-4 w-4 mr-2" />
                                Make Admin
                              </DropdownMenuItem>
                            )}
                            {user.role === "admin" && user.id !== user.id && (
                              <DropdownMenuItem
                                onClick={() =>
                                  updateRoleMutation.mutate({
                                    userId: user.id,
                                    newRole: "employee",
                                  })
                                }
                              >
                                <Users className="h-4 w-4 mr-2" />
                                Make Employee
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => removeUserMutation.mutate(user.id)}
                            >
                              <UserX className="h-4 w-4 mr-2" />
                              Remove User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Invite Modal */}
        <InviteModal
          open={showInviteModal}
          onOpenChange={setShowInviteModal}
          companyId={companyId}
          companyName={company?.name || ""}
          role={inviteRole}
          inviterName={user?.name || user?.email || "Admin"}
        />
      </div>
    </AppLayout>
  );
};

export default CompanyUsersPage;

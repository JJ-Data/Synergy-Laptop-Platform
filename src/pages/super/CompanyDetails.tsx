// File: src/pages/super/CompanyDetails.tsx
// Enhanced company management view for super admins

import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Building,
  Users,
  Laptop,
  DollarSign,
  Mail,
  Settings,
  ArrowLeft,
  Eye,
  Plus,
  Shield,
  User,
  TrendingUp,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";

const CompanyDetails = () => {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "employee">("admin");

  // Fetch company details
  const { data: company, isLoading: loadingCompany } = useQuery({
    queryKey: ["company", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Fetch company stats
  const { data: stats } = useQuery({
    queryKey: ["company-stats", companyId],
    queryFn: async () => {
      const [users, laptops, loans, requests] = await Promise.all([
        supabase
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("company_id", companyId),
        supabase
          .from("laptops")
          .select("*", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("active", true),
        supabase
          .from("loans")
          .select("principal_cents", { count: "exact" })
          .eq("company_id", companyId)
          .eq("status", "active"),
        supabase
          .from("requests")
          .select("*", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("status", "pending"),
      ]);

      const totalLoanAmount =
        loans.data?.reduce(
          (sum: number, loan: any) => sum + (loan.principal_cents || 0),
          0
        ) || 0;

      return {
        users: users.count || 0,
        laptops: laptops.count || 0,
        activeLoans: loans.count || 0,
        totalLoanAmount: totalLoanAmount / 100,
        pendingRequests: requests.count || 0,
      };
    },
    enabled: !!companyId,
  });

  // Fetch company users
  const { data: users = [] } = useQuery({
    queryKey: ["company-users", companyId],
    queryFn: async () => {
      const { data: userRoles, error } = await supabase
        .from("user_roles")
        .select(
          `
          id,
          role,
          created_at,
          profiles:user_id (
            id,
            display_name,
            created_at
          )
        `
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return userRoles || [];
    },
    enabled: !!companyId,
  });

  // Fetch company policy
  const { data: policy } = useQuery({
    queryKey: ["company-policy", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("policies")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Fetch recent requests
  const { data: recentRequests = [] } = useQuery({
    queryKey: ["company-recent-requests", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("requests")
        .select(
          `
          id,
          status,
          requested_amount_cents,
          created_at,
          profiles:employee_id (
            display_name
          ),
          laptops:laptop_id (
            name,
            brand
          )
        `
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Invite user mutation
  const inviteMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("create_invitation", {
        _email: inviteEmail,
        _role: inviteRole,
        _company_id: companyId,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-users", companyId] });
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteDialogOpen(false);
      setInviteEmail("");
    },
    onError: (error: any) => {
      toast.error("Failed to send invitation: " + error.message);
    },
  });

  const handleInvite = () => {
    if (!inviteEmail) {
      toast.error("Please enter an email address");
      return;
    }
    inviteMutation.mutate();
  };

  const getRoleBadge = (role: string) => {
    const variants: any = {
      admin: { color: "default", icon: Shield },
      employee: { color: "secondary", icon: User },
    };
    const variant = variants[role] || variants.employee;
    const Icon = variant.icon;

    return (
      <Badge variant={variant.color as any}>
        <Icon className="h-3 w-3 mr-1" />
        {role}
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: { color: "secondary", icon: Clock },
      approved: { color: "default", icon: CheckCircle },
      rejected: { color: "destructive", icon: AlertCircle },
    };
    const variant = variants[status] || variants.pending;
    const Icon = variant.icon;

    return (
      <Badge variant={variant.color as any}>
        <Icon className="h-3 w-3 mr-1" />
        {status}
      </Badge>
    );
  };

  if (loadingCompany) {
    return (
      <AppLayout title="Loading...">
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">
            Loading company details...
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!company) {
    return (
      <AppLayout title="Company Not Found">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Company not found or you don't have permission to view it.
          </AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={`Manage ${company.name}`}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/super/companies")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Companies
            </Button>
            <div>
              <h1 className="text-3xl font-bold">{company.name}</h1>
              {company.domain && (
                <p className="text-muted-foreground">
                  Domain: {company.domain}
                </p>
              )}
            </div>
          </div>
          <Button onClick={() => setInviteDialogOpen(true)}>
            <Mail className="h-4 w-4 mr-2" />
            Invite User
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <div className="text-sm font-medium">Users</div>
              </div>
              <div className="text-2xl font-bold">{stats?.users || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Laptop className="h-4 w-4 text-green-600" />
                <div className="text-sm font-medium">Laptops</div>
              </div>
              <div className="text-2xl font-bold">{stats?.laptops || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-orange-600" />
                <div className="text-sm font-medium">Active Loans</div>
              </div>
              <div className="text-2xl font-bold">
                {stats?.activeLoans || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-purple-600" />
                <div className="text-sm font-medium">Total Lent</div>
              </div>
              <div className="text-2xl font-bold">
                ₦{(stats?.totalLoanAmount || 0).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-600" />
                <div className="text-sm font-medium">Pending</div>
              </div>
              <div className="text-2xl font-bold">
                {stats?.pendingRequests || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="policy">Policy</TabsTrigger>
            <TabsTrigger value="requests">Recent Requests</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Company Users</CardTitle>
                <CardDescription>
                  Manage administrators and employees
                </CardDescription>
              </CardHeader>
              <CardContent>
                {users.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No users in this company yet</p>
                    <Button
                      className="mt-4"
                      onClick={() => setInviteDialogOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Invite First User
                    </Button>
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
                      {users.map((user: any) => (
                        <TableRow key={user.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {user.profiles?.display_name || "Unknown User"}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                ID: {user.profiles?.id?.slice(0, 8)}...
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{getRoleBadge(user.role)}</TableCell>
                          <TableCell>
                            {new Date(user.created_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Policy Tab */}
          <TabsContent value="policy">
            <Card>
              <CardHeader>
                <CardTitle>Financing Policy</CardTitle>
                <CardDescription>
                  Company lending terms and limits
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!policy ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No policy configured. Company admin needs to set up a
                      policy.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label>Maximum Loan Amount</Label>
                        <div className="text-2xl font-bold">
                          ₦{(policy.max_amount_cents / 100).toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <Label>Interest Rate</Label>
                        <div className="text-2xl font-bold">
                          {policy.interest_rate}% APR
                        </div>
                      </div>
                    </div>
                    <div>
                      <Label>Allowed Durations</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {(policy.durations_months || []).map(
                          (duration: number) => (
                            <Badge key={duration} variant="secondary">
                              {duration} months
                            </Badge>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recent Requests Tab */}
          <TabsContent value="requests">
            <Card>
              <CardHeader>
                <CardTitle>Recent Financing Requests</CardTitle>
                <CardDescription>
                  Latest employee financing applications
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recentRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No financing requests yet
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentRequests.map((request: any) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div>
                          <div className="font-medium">
                            {request.profiles?.display_name ||
                              "Unknown Employee"}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {request.laptops?.brand} {request.laptops?.name} • ₦
                            {(
                              request.requested_amount_cents / 100
                            ).toLocaleString()}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(request.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        {getStatusBadge(request.status)}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>Company Settings</CardTitle>
                <CardDescription>Manage company configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Company Name</Label>
                  <Input value={company.name} disabled />
                </div>
                <div>
                  <Label>Domain</Label>
                  <Input value={company.domain || ""} disabled />
                </div>
                <div>
                  <Label>Created</Label>
                  <Input
                    value={new Date(company.created_at).toLocaleDateString()}
                    disabled
                  />
                </div>
                <Alert>
                  <Settings className="h-4 w-4" />
                  <AlertDescription>
                    Contact development team to update company settings.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite User to {company.name}</DialogTitle>
            <DialogDescription>
              Send an invitation to add a new user to this company
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="user@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(value) =>
                  setInviteRole(value as "admin" | "employee")
                }
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Company Admin</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setInviteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleInvite} disabled={inviteMutation.isPending}>
              {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default CompanyDetails;

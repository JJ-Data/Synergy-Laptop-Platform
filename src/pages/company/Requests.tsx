import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import Seo from "@/components/seo/Seo";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import { useCompany } from "@/context/CompanyContext";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
} from "lucide-react";
import type { Tables } from "@/lib/supabase/types";

function computeMonthly(
  principal: number,
  months: number,
  interestRate: number
) {
  const monthlyRate = interestRate / 100 / 12;
  const payment =
    monthlyRate === 0
      ? principal / months
      : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
  return Math.round(payment);
}

type RequestRow = Tables<"requests"> & {
  laptop?: { name: string | null; brand: string | null } | null;
  employee?: { display_name: string | null; email?: string | null } | null;
};

const Requests = () => {
  const { companyId, company } = useCompany();
  const qc = useQueryClient();

  const {
    data: requests = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["pending-requests", companyId],
    queryFn: async () => {
      if (!companyId) return [] as RequestRow[];

      try {
        // First, get the basic request data
        const { data: baseRequests, error: requestsError } = await supabase
          .from("requests")
          .select("*")
          .eq("company_id", companyId)
          .eq("status", "pending")
          .order("created_at", { ascending: true });

        if (requestsError) throw requestsError;
        if (!baseRequests?.length) return [];

        let requests = baseRequests as RequestRow[];

        // Try to enrich with laptop data
        try {
          const laptopIds = requests.map((r) => r.laptop_id);
          if (laptopIds.length > 0) {
            const { data: laptops } = await supabase
              .from("laptops")
              .select("id, name, brand")
              .in("id", laptopIds);

            if (laptops) {
              requests = requests.map((r) => ({
                ...r,
                laptop: laptops.find((l) => l.id === r.laptop_id) || {
                  name: "Unknown Laptop",
                  brand: null,
                },
              }));
            }
          }
        } catch (laptopError) {
          console.warn("Could not fetch laptop details:", laptopError);
          // Continue without laptop details
        }

        // Try to enrich with employee profile data
        try {
          const employeeIds = requests.map((r) => r.employee_id);
          if (employeeIds.length > 0) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id, display_name")
              .in("id", employeeIds);

            if (profiles) {
              requests = requests.map((r) => ({
                ...r,
                employee: profiles.find((p) => p.id === r.employee_id) || {
                  display_name: null,
                },
              }));
            }
          }
        } catch (profileError) {
          console.warn(
            "Could not fetch employee profiles due to RLS restrictions:",
            profileError
          );
          // Try to get email from auth users as fallback
          try {
            const { data: authUsers } = await supabase.auth.admin.listUsers();
            if (authUsers?.users) {
              requests = requests.map((r) => {
                const authUser = authUsers.users.find(
                  (u) => u.id === r.employee_id
                );
                return {
                  ...r,
                  employee: {
                    display_name:
                      authUser?.email?.split("@")[0] || "Unknown User",
                    email: authUser?.email,
                  },
                };
              });
            }
          } catch (authError) {
            console.warn("Could not fetch auth user data:", authError);
            // Use employee ID as fallback
            requests = requests.map((r) => ({
              ...r,
              employee: { display_name: `User ${r.employee_id.slice(0, 8)}` },
            }));
          }
        }

        return requests;
      } catch (error) {
        console.error("Error fetching requests:", error);
        throw error;
      }
    },
    enabled: !!companyId,
    retry: 2,
  });

  const approveMutation = useMutation({
    mutationFn: async (req: RequestRow) => {
      try {
        // Get company policy for interest rate
        const { data: policy } = await supabase
          .from("policies")
          .select("interest_rate")
          .eq("company_id", req.company_id)
          .maybeSingle();

        const rate = policy?.interest_rate ?? 0;
        const start = new Date();
        const end = new Date(start);
        end.setMonth(end.getMonth() + req.duration_months);

        // Create loan
        const { data: loan, error: loanError } = await supabase
          .from("loans")
          .insert({
            company_id: req.company_id,
            employee_id: req.employee_id,
            request_id: req.id,
            principal_cents: req.requested_amount_cents,
            interest_rate: rate,
            start_date: start.toISOString().split("T")[0],
            end_date: end.toISOString().split("T")[0],
          })
          .select("id")
          .single();

        if (loanError) throw loanError;

        // Calculate monthly payment
        const monthly =
          computeMonthly(
            req.requested_amount_cents / 100,
            req.duration_months,
            rate
          ) * 100;

        // Create repayment schedule
        const repayments = Array.from(
          { length: req.duration_months },
          (_, i) => {
            const due = new Date(start);
            due.setMonth(due.getMonth() + i + 1);
            return {
              company_id: req.company_id,
              employee_id: req.employee_id,
              loan_id: loan.id,
              due_date: due.toISOString().split("T")[0],
              amount_cents: monthly,
            } as Tables<"repayments">;
          }
        );

        const { error: repayError } = await supabase
          .from("repayments")
          .insert(repayments);

        if (repayError) throw repayError;

        // Update request status
        const { error: reqError } = await supabase
          .from("requests")
          .update({ status: "approved", decided_at: new Date().toISOString() })
          .eq("id", req.id);

        if (reqError) throw reqError;

        return { success: true };
      } catch (error) {
        console.error("Approval process failed:", error);
        throw error;
      }
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["pending-requests", companyId] });
      toast.success("Request approved successfully");
    },
    onError: (e: unknown) => {
      const message =
        e instanceof Error ? e.message : "Failed to approve request";
      toast.error("Approval failed: " + message);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("requests")
        .update({ status: "rejected", decided_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["pending-requests", companyId] });
      toast.success("Request rejected");
    },
    onError: (e: unknown) => {
      const message =
        e instanceof Error ? e.message : "Failed to reject request";
      toast.error("Rejection failed: " + message);
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  if (!companyId) {
    return (
      <AppLayout title="Requests">
        <Seo
          title="Requests | Company Admin"
          description="Review and approve employee device financing requests."
        />
        <div className="text-center py-8 text-muted-foreground">
          No company context. Please log in as a company admin.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Requests">
      <Seo
        title="Requests | Company Admin"
        description="Review and approve employee device financing requests."
      />

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Financing Requests</h1>
          <p className="text-muted-foreground">
            Review and process employee device financing requests for{" "}
            {company?.name}
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Failed to load requests:{" "}
              {error instanceof Error ? error.message : "Unknown error"}
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Requests ({requests.length})
            </CardTitle>
            <CardDescription>
              Requests awaiting your review and approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-3 p-8 text-center">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-muted-foreground">
                  Loading requests...
                </span>
              </div>
            ) : requests.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="font-medium">All caught up!</h3>
                <p className="text-muted-foreground">
                  No pending requests at the moment.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Monthly Payment</TableHead>
                      <TableHead>Submitted</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((r) => {
                      // Calculate estimated monthly payment for preview
                      const monthlyEstimate = computeMonthly(
                        r.requested_amount_cents / 100,
                        r.duration_months,
                        0 // Using 0% for estimation, real rate will be applied on approval
                      );

                      return (
                        <TableRow key={r.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {r.employee?.display_name || "Unknown User"}
                              </div>
                              {r.employee?.email && (
                                <div className="text-sm text-muted-foreground">
                                  {r.employee.email}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {r.laptop?.brand && r.laptop?.name
                                  ? `${r.laptop.brand} ${r.laptop.name}`
                                  : r.laptop?.name || "Unknown Device"}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-mono">
                              ₦
                              {(
                                r.requested_amount_cents / 100
                              ).toLocaleString()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {r.duration_months} months
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="font-mono text-sm">
                              ~₦{monthlyEstimate.toLocaleString()}/mo
                            </div>
                            <div className="text-xs text-muted-foreground">
                              (estimated)
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {new Date(r.created_at).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(r.created_at).toLocaleTimeString()}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                size="sm"
                                onClick={() => approveMutation.mutate(r)}
                                disabled={
                                  approveMutation.isPending ||
                                  rejectMutation.isPending
                                }
                                className="bg-green-600 hover:bg-green-700"
                              >
                                {approveMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-4 w-4" />
                                )}
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => rejectMutation.mutate(r.id)}
                                disabled={
                                  approveMutation.isPending ||
                                  rejectMutation.isPending
                                }
                              >
                                {rejectMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <XCircle className="h-4 w-4" />
                                )}
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        {requests.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-8 w-8 text-yellow-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Pending Requests
                    </p>
                    <p className="text-2xl font-bold">{requests.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-blue-600 font-bold">₦</span>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Value</p>
                    <p className="text-2xl font-bold">
                      ₦
                      {Math.round(
                        requests.reduce(
                          (sum, r) => sum + r.requested_amount_cents,
                          0
                        ) / 100
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                    <span className="text-green-600 font-bold">Avg</span>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Average Duration
                    </p>
                    <p className="text-2xl font-bold">
                      {Math.round(
                        requests.reduce(
                          (sum, r) => sum + r.duration_months,
                          0
                        ) / requests.length
                      )}{" "}
                      mo
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default Requests;

// File: src/pages/company/Loans.tsx
import AppLayout from "@/components/layout/AppLayout";
import Seo from "@/components/seo/Seo";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/context/CompanyContext";
import { useState } from "react";
import { toast } from "sonner";
import {
  DollarSign,
  TrendingUp,
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Eye,
  Calendar,
  CreditCard,
  FileText,
  Download,
  BarChart3,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { calculateLoanProgress } from "@/lib/finance";

// Enhanced types
type LoanWithDetails = {
  id: string;
  principal_cents: number;
  interest_rate: number;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
  employee_id: string;
  requests: {
    laptops: {
      name: string;
      brand: string;
      image_url?: string;
    };
  };
  profiles: {
    display_name?: string;
    avatar_url?: string;
  };
};

type RepaymentWithDetails = {
  id: string;
  due_date: string;
  amount_cents: number;
  paid_at?: string;
  status: string;
  loan_id: string;
  employee_id: string;
  profiles: {
    display_name?: string;
  };
};

const Loans = () => {
  const { companyId, company } = useCompany();
  const queryClient = useQueryClient();
  const [selectedLoan, setSelectedLoan] = useState<LoanWithDetails | null>(
    null
  );
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch company loans
  const { data: loans = [], isLoading: loadingLoans } = useQuery({
    queryKey: ["company-loans", companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from("loans")
        .select(
          `
          *,
          requests!inner(
            laptops!inner(name, brand, image_url)
          ),
          profiles!loans_employee_id_fkey(display_name, avatar_url)
        `
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LoanWithDetails[];
    },
    enabled: !!companyId,
  });

  // Fetch all repayments for company loans
  const { data: repayments = [], isLoading: loadingRepayments } = useQuery({
    queryKey: ["company-repayments", companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from("repayments")
        .select(
          `
          *,
          profiles!repayments_employee_id_fkey(display_name)
        `
        )
        .eq("company_id", companyId)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data as RepaymentWithDetails[];
    },
    enabled: !!companyId,
  });

  // Mark repayment as paid mutation
  const markPaidMutation = useMutation({
    mutationFn: async (repaymentId: string) => {
      const { error } = await supabase
        .from("repayments")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", repaymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-repayments"] });
      toast.success("Payment marked as paid successfully");
    },
    onError: (error) => {
      toast.error("Failed to update payment: " + error.message);
    },
  });

  // Calculate comprehensive stats
  const stats = {
    totalLoans: loans.length,
    activeLoans: loans.filter((l) => l.status === "active").length,
    totalLentAmount:
      loans.reduce((sum, loan) => sum + loan.principal_cents, 0) / 100,
    totalRepaid:
      repayments
        .filter((r) => r.status === "paid")
        .reduce((sum, r) => sum + r.amount_cents, 0) / 100,
    outstandingAmount:
      repayments
        .filter((r) => r.status === "due")
        .reduce((sum, r) => sum + r.amount_cents, 0) / 100,
    overduePayments: repayments.filter((r) => {
      return new Date(r.due_date) < new Date() && r.status === "due";
    }).length,
    repaymentRate:
      repayments.length > 0
        ? Math.round(
            (repayments.filter((r) => r.status === "paid").length /
              repayments.length) *
              100
          )
        : 0,
  };

  // Get upcoming repayments (next 30 days)
  const upcomingRepayments = repayments.filter((r) => {
    if (r.status !== "due") return false;
    const dueDate = new Date(r.due_date);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return dueDate <= thirtyDaysFromNow;
  });

  // Get overdue repayments
  const overdueRepayments = repayments.filter((r) => {
    return new Date(r.due_date) < new Date() && r.status === "due";
  });

  const openLoanDetails = (loan: LoanWithDetails) => {
    setSelectedLoan(loan);
    setIsDetailsDialogOpen(true);
  };

  if (!companyId) {
    return (
      <AppLayout title="Loans">
        <Seo
          title="Loans | Company Admin"
          description="Manage company loans and repayments."
        />
        <div className="text-center py-8 text-muted-foreground">
          No company context. Please log in as a company admin.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Loan Management">
      <Seo
        title="Loans | Company Admin"
        description="Manage company loans and repayment tracking."
      />

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Loan Management</h1>
          <p className="text-muted-foreground">
            Monitor and manage employee laptop financing for {company?.name}
          </p>
        </div>

        {/* Key Metrics Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-600" />
                <div className="text-sm font-medium">Active Loans</div>
              </div>
              <div className="text-2xl font-bold">{stats.activeLoans}</div>
              <div className="text-xs text-muted-foreground">
                of {stats.totalLoans} total
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <div className="text-sm font-medium">Total Lent</div>
              </div>
              <div className="text-2xl font-bold">
                ₦{stats.totalLentAmount.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-purple-600" />
                <div className="text-sm font-medium">Repayment Rate</div>
              </div>
              <div className="text-2xl font-bold">{stats.repaymentRate}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <div className="text-sm font-medium">Overdue</div>
              </div>
              <div className="text-2xl font-bold">{stats.overduePayments}</div>
            </CardContent>
          </Card>
        </div>

        {/* Financial Overview Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <span className="text-sm font-medium">Total Repaid</span>
                <span className="font-bold text-green-600">
                  ₦{stats.totalRepaid.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded-lg">
                <span className="text-sm font-medium">Outstanding</span>
                <span className="font-bold text-orange-600">
                  ₦{stats.outstandingAmount.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <span className="text-sm font-medium">Collection Rate</span>
                <span className="font-bold text-blue-600">
                  {stats.repaymentRate}%
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Upcoming Payments
              </CardTitle>
              <CardDescription>Next 30 days</CardDescription>
            </CardHeader>
            <CardContent>
              {upcomingRepayments.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No upcoming payments
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingRepayments.slice(0, 5).map((repayment) => (
                    <div
                      key={repayment.id}
                      className="flex justify-between items-center"
                    >
                      <div>
                        <div className="font-medium text-sm">
                          {repayment.profiles?.display_name ||
                            "Unknown Employee"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Due{" "}
                          {new Date(repayment.due_date).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold">
                          ₦
                          {Math.round(
                            repayment.amount_cents / 100
                          ).toLocaleString()}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-xs"
                          onClick={() => markPaidMutation.mutate(repayment.id)}
                          disabled={markPaidMutation.isPending}
                        >
                          Mark Paid
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">All Loans</TabsTrigger>
            <TabsTrigger value="active">Active Loans</TabsTrigger>
            <TabsTrigger value="overdue">Overdue Payments</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>

          {/* All Loans Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Company Loans</CardTitle>
                <CardDescription>
                  Complete overview of employee financing
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingLoans ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading loans...
                  </div>
                ) : loans.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No loans found
                  </div>
                ) : (
                  <div className="space-y-4">
                    {loans.map((loan) => {
                      const progress = calculateLoanProgress(
                        repayments,
                        loan.id
                      );
                      const loanRepayments = repayments.filter(
                        (r) => r.loan_id === loan.id
                      );
                      const remainingAmount =
                        loanRepayments
                          .filter((r) => r.status === "due")
                          .reduce((sum, r) => sum + r.amount_cents, 0) / 100;

                      return (
                        <div
                          key={loan.id}
                          className="border rounded-lg p-6 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-4">
                              <Avatar className="h-12 w-12">
                                <AvatarImage
                                  src={loan.profiles?.avatar_url || undefined}
                                />
                                <AvatarFallback>
                                  <User className="h-6 w-6" />
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">
                                  {loan.profiles?.display_name ||
                                    "Unknown Employee"}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {loan.requests.laptops.brand}{" "}
                                  {loan.requests.laptops.name}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Started{" "}
                                  {new Date(
                                    loan.start_date
                                  ).toLocaleDateString()}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-lg">
                                ₦
                                {Math.round(
                                  loan.principal_cents / 100
                                ).toLocaleString()}
                              </div>
                              <Badge
                                variant={
                                  loan.status === "active"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {loan.status}
                              </Badge>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm">Progress</span>
                                <span className="text-sm text-muted-foreground">
                                  {Math.round(progress)}%
                                </span>
                              </div>
                              <Progress value={progress} className="h-2" />
                            </div>

                            <div className="grid grid-cols-3 gap-4 text-center">
                              <div className="p-2 bg-muted rounded">
                                <div className="text-sm font-medium">
                                  ₦
                                  {Math.round(
                                    loan.principal_cents / 100
                                  ).toLocaleString()}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Principal
                                </div>
                              </div>
                              <div className="p-2 bg-muted rounded">
                                <div className="text-sm font-medium">
                                  ₦{remainingAmount.toLocaleString()}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Remaining
                                </div>
                              </div>
                              <div className="p-2 bg-muted rounded">
                                <div className="text-sm font-medium">
                                  {loan.interest_rate}%
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Interest
                                </div>
                              </div>
                            </div>

                            <div className="flex justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openLoanDetails(loan)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View Details
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Active Loans Tab */}
          <TabsContent value="active" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Active Loans</CardTitle>
                <CardDescription>
                  Currently active employee financing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {loans
                    .filter((l) => l.status === "active")
                    .map((loan) => (
                      <div key={loan.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage
                                src={loan.profiles?.avatar_url || undefined}
                              />
                              <AvatarFallback>
                                <User className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">
                                {loan.profiles?.display_name || "Unknown"}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {loan.requests.laptops.brand}{" "}
                                {loan.requests.laptops.name}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">
                              ₦
                              {Math.round(
                                loan.principal_cents / 100
                              ).toLocaleString()}
                            </div>
                            <Progress
                              value={calculateLoanProgress(repayments, loan.id)}
                              className="w-24 h-2 mt-1"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Overdue Payments Tab */}
          <TabsContent value="overdue" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                  Overdue Payments
                </CardTitle>
                <CardDescription>Payments that are past due</CardDescription>
              </CardHeader>
              <CardContent>
                {overdueRepayments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600" />
                    <div>No overdue payments!</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {overdueRepayments.map((repayment) => (
                      <div
                        key={repayment.id}
                        className="border border-red-200 rounded-lg p-4 bg-red-50"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-red-800">
                              {repayment.profiles?.display_name ||
                                "Unknown Employee"}
                            </div>
                            <div className="text-sm text-red-600">
                              ₦
                              {Math.round(
                                repayment.amount_cents / 100
                              ).toLocaleString()}{" "}
                              overdue
                            </div>
                            <div className="text-sm text-red-600">
                              Due:{" "}
                              {new Date(
                                repayment.due_date
                              ).toLocaleDateString()}
                            </div>
                          </div>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() =>
                              markPaidMutation.mutate(repayment.id)
                            }
                            disabled={markPaidMutation.isPending}
                          >
                            Mark as Paid
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Completed Tab */}
          <TabsContent value="completed" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Completed Loans</CardTitle>
                <CardDescription>Fully paid off loans</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {loans.filter((l) => l.status === "paid").length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No completed loans yet
                    </div>
                  ) : (
                    loans
                      .filter((l) => l.status === "paid")
                      .map((loan) => (
                        <div
                          key={loan.id}
                          className="border border-green-200 rounded-lg p-4 bg-green-50"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <CheckCircle className="h-6 w-6 text-green-600" />
                              <div>
                                <div className="font-medium">
                                  {loan.profiles?.display_name || "Unknown"}
                                </div>
                                <div className="text-sm text-green-700">
                                  {loan.requests.laptops.brand}{" "}
                                  {loan.requests.laptops.name}
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-green-800">
                                ₦
                                {Math.round(
                                  loan.principal_cents / 100
                                ).toLocaleString()}
                              </div>
                              <div className="text-sm text-green-600">
                                Completed
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Loan Details Modal */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Loan Details</DialogTitle>
            <DialogDescription>
              Complete loan and repayment information
            </DialogDescription>
          </DialogHeader>

          {selectedLoan && (
            <div className="space-y-6">
              {/* Loan Overview */}
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3">Loan Information</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Employee:</span>
                      <span className="font-medium">
                        {selectedLoan.profiles?.display_name || "Unknown"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Device:</span>
                      <span className="font-medium">
                        {selectedLoan.requests.laptops.brand}{" "}
                        {selectedLoan.requests.laptops.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Principal Amount:</span>
                      <span className="font-medium">
                        ₦
                        {Math.round(
                          selectedLoan.principal_cents / 100
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Interest Rate:</span>
                      <span className="font-medium">
                        {selectedLoan.interest_rate}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Start Date:</span>
                      <span className="font-medium">
                        {new Date(selectedLoan.start_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>End Date:</span>
                      <span className="font-medium">
                        {new Date(selectedLoan.end_date).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Repayment Progress</h4>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">Progress</span>
                        <span className="text-sm">
                          {Math.round(
                            calculateLoanProgress(repayments, selectedLoan.id)
                          )}
                          %
                        </span>
                      </div>
                      <Progress
                        value={calculateLoanProgress(
                          repayments,
                          selectedLoan.id
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="text-center p-2 bg-green-50 rounded">
                        <div className="font-medium text-green-800">
                          {
                            repayments.filter(
                              (r) =>
                                r.loan_id === selectedLoan.id &&
                                r.status === "paid"
                            ).length
                          }
                        </div>
                        <div className="text-green-600">Paid</div>
                      </div>
                      <div className="text-center p-2 bg-orange-50 rounded">
                        <div className="font-medium text-orange-800">
                          {
                            repayments.filter(
                              (r) =>
                                r.loan_id === selectedLoan.id &&
                                r.status === "due"
                            ).length
                          }
                        </div>
                        <div className="text-orange-600">Remaining</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Repayment Schedule */}
              <div>
                <h4 className="font-medium mb-3">Repayment Schedule</h4>
                <div className="max-h-64 overflow-y-auto border rounded-lg">
                  <div className="space-y-2 p-4">
                    {repayments
                      .filter((r) => r.loan_id === selectedLoan.id)
                      .map((repayment) => (
                        <div
                          key={repayment.id}
                          className="flex justify-between items-center p-2 border rounded"
                        >
                          <div>
                            <div className="text-sm font-medium">
                              ₦
                              {Math.round(
                                repayment.amount_cents / 100
                              ).toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Due:{" "}
                              {new Date(
                                repayment.due_date
                              ).toLocaleDateString()}
                            </div>
                          </div>
                          <Badge
                            variant={
                              repayment.status === "paid"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {repayment.status}
                          </Badge>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDetailsDialogOpen(false)}
            >
              Close
            </Button>
            <Button>
              <Download className="h-4 w-4 mr-2" />
              Export Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Loans;

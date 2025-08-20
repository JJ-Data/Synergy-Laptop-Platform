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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
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
  BarChart3,
} from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { calculateLoanProgress } from "@/lib/finance";
import LoanTable from "@/components/company/LoanTable";
import LoanDetailsDialog from "@/components/company/LoanDetailsDialog";
import type { LoanWithDetails, RepaymentWithDetails } from "@/types/loan";

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
            <LoanTable
              loans={loans}
              repayments={repayments}
              loading={loadingLoans}
              onViewDetails={openLoanDetails}
            />
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
      <LoanDetailsDialog
        open={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
        loan={selectedLoan}
        repayments={repayments}
      />
    </AppLayout>
  );
};

export default Loans;

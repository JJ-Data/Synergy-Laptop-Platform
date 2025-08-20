// File: src/pages/employee/Repayments.tsx
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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  Calendar,
  CreditCard,
  DollarSign,
  Download,
  CheckCircle,
  AlertCircle,
  Clock,
  TrendingUp,
  Laptop,
  FileText,
} from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
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
  requests: {
    laptops: {
      name: string;
      brand: string;
      image_url?: string;
    };
  };
};

type RepaymentWithDetails = {
  id: string;
  due_date: string;
  amount_cents: number;
  paid_at?: string;
  status: string;
  loan_id: string;
};

// Helper function to get repayment status info
function getRepaymentStatusInfo(status: string, dueDate: string) {
  const isOverdue = new Date(dueDate) < new Date() && status === "due";

  if (status === "paid") {
    return {
      color: "bg-green-100 text-green-800 border-green-200",
      icon: CheckCircle,
      label: "Paid",
      variant: "default" as const,
    };
  } else if (isOverdue) {
    return {
      color: "bg-red-100 text-red-800 border-red-200",
      icon: AlertCircle,
      label: "Overdue",
      variant: "destructive" as const,
    };
  } else {
    return {
      color: "bg-yellow-100 text-yellow-800 border-yellow-200",
      icon: Clock,
      label: "Due",
      variant: "secondary" as const,
    };
  }
}

const Repayments = () => {
  const { user } = useAuth();

  // Fetch user's active loans
  const { data: loans = [], isLoading: loadingLoans } = useQuery({
    queryKey: ["user-loans", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("loans")
        .select(
          `
          *,
          requests!inner(
            laptops!inner(name, brand, image_url)
          )
        `
        )
        .eq("employee_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as LoanWithDetails[];
    },
    enabled: !!user?.id,
  });

  // Fetch all repayments for user's loans
  const { data: repayments = [], isLoading: loadingRepayments } = useQuery({
    queryKey: ["user-repayments", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data, error } = await supabase
        .from("repayments")
        .select("*")
        .eq("employee_id", user.id)
        .order("due_date", { ascending: true });

      if (error) throw error;
      return data as RepaymentWithDetails[];
    },
    enabled: !!user?.id,
  });

  // Calculate summary stats
  const stats = {
    totalLoans: loans.length,
    activeLoans: loans.filter((l) => l.status === "active").length,
    totalBorrowed:
      loans.reduce((sum, loan) => sum + loan.principal_cents, 0) / 100,
    totalRepaid:
      repayments
        .filter((r) => r.status === "paid")
        .reduce((sum, r) => sum + r.amount_cents, 0) / 100,
    nextPayment: repayments.find((r) => r.status === "due"),
    overduePayments: repayments.filter((r) => {
      const isOverdue = new Date(r.due_date) < new Date() && r.status === "due";
      return isOverdue;
    }).length,
  };

  // Group repayments by loan
  const repaymentsByLoan = repayments.reduce((acc, repayment) => {
    if (!acc[repayment.loan_id]) {
      acc[repayment.loan_id] = [];
    }
    acc[repayment.loan_id].push(repayment);
    return acc;
  }, {} as Record<string, RepaymentWithDetails[]>);

  // Get upcoming repayments (next 30 days)
  const upcomingRepayments = repayments.filter((r) => {
    if (r.status !== "due") return false;
    const dueDate = new Date(r.due_date);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return dueDate <= thirtyDaysFromNow;
  });

  return (
    <AppLayout title="Repayments">
      <Seo
        title="Repayments | Employee"
        description="View your repayment schedule, deductions, and outstanding balance."
      />

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">My Repayments</h1>
          <p className="text-muted-foreground">
            Track your loan repayments and payment schedule
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Laptop className="h-4 w-4 text-blue-600" />
                <div className="text-sm font-medium">Active Loans</div>
              </div>
              <div className="text-2xl font-bold">{stats.activeLoans}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <div className="text-sm font-medium">Total Borrowed</div>
              </div>
              <div className="text-2xl font-bold">
                ₦{stats.totalBorrowed.toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div className="text-sm font-medium">Total Repaid</div>
              </div>
              <div className="text-2xl font-bold">
                ₦{stats.totalRepaid.toLocaleString()}
              </div>
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

        {/* Next Payment Alert */}
        {stats.nextPayment && (
          <Card className="border-orange-200 bg-orange-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-orange-600" />
                  <div>
                    <div className="font-medium">Next Payment Due</div>
                    <div className="text-sm text-muted-foreground">
                      ₦
                      {Math.round(
                        stats.nextPayment.amount_cents / 100
                      ).toLocaleString()}{" "}
                      due on{" "}
                      {new Date(
                        stats.nextPayment.due_date
                      ).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <Button variant="outline">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Pay Now
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        {loadingLoans || loadingRepayments ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                Loading repayment information...
              </div>
            </CardContent>
          </Card>
        ) : loans.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                <Laptop className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <div className="text-lg font-medium mb-2">No Active Loans</div>
                <div className="text-sm">
                  You don't have any active loans yet. Submit a financing
                  request to get started.
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="schedule">Payment Schedule</TabsTrigger>
              <TabsTrigger value="history">Payment History</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid gap-6">
                {loans.map((loan) => {
                  const loanRepayments = repaymentsByLoan[loan.id] || [];
                  const progress = calculateLoanProgress(loanRepayments);
                  const remainingAmount =
                    loanRepayments
                      .filter((r) => r.status === "due")
                      .reduce((sum, r) => sum + r.amount_cents, 0) / 100;

                  return (
                    <Card key={loan.id}>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden">
                              <img
                                src={
                                  loan.requests.laptops.image_url ||
                                  "/placeholder.svg"
                                }
                                alt={loan.requests.laptops.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div>
                              <CardTitle className="text-xl">
                                {loan.requests.laptops.brand}{" "}
                                {loan.requests.laptops.name}
                              </CardTitle>
                              <CardDescription>
                                Loan started{" "}
                                {new Date(loan.start_date).toLocaleDateString()}
                              </CardDescription>
                            </div>
                          </div>
                          <Badge
                            variant={
                              loan.status === "active" ? "default" : "secondary"
                            }
                          >
                            {loan.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        {/* Progress Bar */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium">
                              Repayment Progress
                            </span>
                            <span className="text-sm text-muted-foreground">
                              {Math.round(progress)}% complete
                            </span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>

                        {/* Loan Details */}
                        <div className="grid md:grid-cols-3 gap-4">
                          <div className="text-center p-4 bg-blue-50 rounded-lg">
                            <div className="text-2xl font-bold text-blue-600">
                              ₦
                              {Math.round(
                                loan.principal_cents / 100
                              ).toLocaleString()}
                            </div>
                            <div className="text-sm text-blue-700">
                              Original Amount
                            </div>
                          </div>
                          <div className="text-center p-4 bg-orange-50 rounded-lg">
                            <div className="text-2xl font-bold text-orange-600">
                              ₦{remainingAmount.toLocaleString()}
                            </div>
                            <div className="text-sm text-orange-700">
                              Remaining Balance
                            </div>
                          </div>
                          <div className="text-center p-4 bg-green-50 rounded-lg">
                            <div className="text-2xl font-bold text-green-600">
                              {loan.interest_rate}%
                            </div>
                            <div className="text-sm text-green-700">
                              Interest Rate
                            </div>
                          </div>
                        </div>

                        {/* Upcoming Payments for this loan */}
                        <div>
                          <h4 className="font-medium mb-3">
                            Upcoming Payments
                          </h4>
                          <div className="space-y-2">
                            {loanRepayments
                              .filter((r) => r.status === "due")
                              .slice(0, 3)
                              .map((repayment) => {
                                const statusInfo = getRepaymentStatusInfo(
                                  repayment.status,
                                  repayment.due_date
                                );
                                const StatusIcon = statusInfo.icon;
                                return (
                                  <div
                                    key={repayment.id}
                                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                                  >
                                    <div className="flex items-center gap-3">
                                      <StatusIcon className="h-4 w-4 text-muted-foreground" />
                                      <div>
                                        <div className="font-medium">
                                          ₦
                                          {Math.round(
                                            repayment.amount_cents / 100
                                          ).toLocaleString()}
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                          Due{" "}
                                          {new Date(
                                            repayment.due_date
                                          ).toLocaleDateString()}
                                        </div>
                                      </div>
                                    </div>
                                    <Badge
                                      variant={statusInfo.variant}
                                      className={statusInfo.color}
                                    >
                                      {statusInfo.label}
                                    </Badge>
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            {/* Payment Schedule Tab */}
            <TabsContent value="schedule" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Complete Payment Schedule</CardTitle>
                  <CardDescription>
                    All your upcoming and past payments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {repayments.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No payment schedule available
                      </div>
                    ) : (
                      repayments.map((repayment) => {
                        const statusInfo = getRepaymentStatusInfo(
                          repayment.status,
                          repayment.due_date
                        );
                        const StatusIcon = statusInfo.icon;
                        const loan = loans.find(
                          (l) => l.id === repayment.loan_id
                        );

                        return (
                          <div
                            key={repayment.id}
                            className="flex items-center justify-between p-4 border rounded-lg"
                          >
                            <div className="flex items-center gap-4">
                              <StatusIcon
                                className={`h-5 w-5 ${
                                  repayment.status === "paid"
                                    ? "text-green-600"
                                    : repayment.status === "due" &&
                                      new Date(repayment.due_date) < new Date()
                                    ? "text-red-600"
                                    : "text-yellow-600"
                                }`}
                              />
                              <div>
                                <div className="font-medium">
                                  ₦
                                  {Math.round(
                                    repayment.amount_cents / 100
                                  ).toLocaleString()}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {loan &&
                                    `${loan.requests.laptops.brand} ${loan.requests.laptops.name}`}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  Due:{" "}
                                  {new Date(
                                    repayment.due_date
                                  ).toLocaleDateString()}
                                  {repayment.paid_at &&
                                    ` • Paid: ${new Date(
                                      repayment.paid_at
                                    ).toLocaleDateString()}`}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge
                                variant={statusInfo.variant}
                                className={statusInfo.color}
                              >
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusInfo.label}
                              </Badge>
                              {repayment.status === "due" && (
                                <Button size="sm" variant="outline">
                                  <CreditCard className="h-4 w-4 mr-1" />
                                  Pay
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Payment History Tab */}
            <TabsContent value="history" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Payment History</CardTitle>
                      <CardDescription>
                        Your completed payments and receipts
                      </CardDescription>
                    </div>
                    <Button variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Download Statement
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {repayments.filter((r) => r.status === "paid").length ===
                    0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <div>No payment history yet</div>
                      </div>
                    ) : (
                      repayments
                        .filter((r) => r.status === "paid")
                        .map((repayment) => {
                          const loan = loans.find(
                            (l) => l.id === repayment.loan_id
                          );
                          return (
                            <div
                              key={repayment.id}
                              className="flex items-center justify-between p-4 border rounded-lg bg-green-50"
                            >
                              <div className="flex items-center gap-4">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                                <div>
                                  <div className="font-medium">
                                    ₦
                                    {Math.round(
                                      repayment.amount_cents / 100
                                    ).toLocaleString()}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {loan &&
                                      `${loan.requests.laptops.brand} ${loan.requests.laptops.name}`}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    Paid on{" "}
                                    {new Date(
                                      repayment.paid_at!
                                    ).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <Badge
                                  variant="default"
                                  className="bg-green-100 text-green-800"
                                >
                                  Paid
                                </Badge>
                                <Button size="sm" variant="outline">
                                  <Download className="h-4 w-4 mr-1" />
                                  Receipt
                                </Button>
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </AppLayout>
  );
};

export default Repayments;

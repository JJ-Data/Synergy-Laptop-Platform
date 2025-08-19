import AppLayout from "@/components/layout/AppLayout";
import Seo from "@/components/seo/Seo";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Calendar, CreditCard, TrendingUp } from "lucide-react";

const Repayments = () => {
  const { user } = useAuth();

  const { data: loans, isLoading: loansLoading } = useQuery({
    queryKey: ["loans", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("loans")
        .select(
          `
          *,
          requests(
            laptops(name, brand)
          )
        `
        )
        .eq("employee_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const { data: repayments, isLoading: repaymentsLoading } = useQuery({
    queryKey: ["repayments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("repayments")
        .select("*")
        .eq("employee_id", user.id)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const activeLoan = loans?.find((l) => l.status === "active");
  const loanRepayments =
    repayments?.filter((r) => r.loan_id === activeLoan?.id) || [];
  const paidCount = loanRepayments.filter((r) => r.status === "paid").length;
  const totalCount = loanRepayments.length;
  const progress = totalCount > 0 ? (paidCount / totalCount) * 100 : 0;

  const totalPaid = loanRepayments
    .filter((r) => r.status === "paid")
    .reduce((sum, r) => sum + (r.amount_cents || 0), 0);

  const totalRemaining = loanRepayments
    .filter((r) => r.status !== "paid")
    .reduce((sum, r) => sum + (r.amount_cents || 0), 0);

  const nextPayment = loanRepayments.find((r) => r.status === "due");

  const getStatusBadge = (status: string) => {
    const variants: any = {
      due: "secondary",
      paid: "default",
      late: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  const isLoading = loansLoading || repaymentsLoading;

  return (
    <AppLayout title="Repayments">
      <Seo
        title="Repayments | Employee"
        description="View your repayment schedule and outstanding balance."
      />

      <div className="space-y-6">
        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Total Paid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₦{(totalPaid / 100).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Outstanding
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₦{(totalRemaining / 100).toLocaleString()}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Next Payment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {nextPayment
                  ? new Date(nextPayment.due_date).toLocaleDateString()
                  : "—"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Loan */}
        {activeLoan && (
          <Card>
            <CardHeader>
              <CardTitle>Active Financing</CardTitle>
              <CardDescription>
                {activeLoan.requests?.laptops?.brand}{" "}
                {activeLoan.requests?.laptops?.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Progress</span>
                  <span>
                    {paidCount} of {totalCount} payments
                  </span>
                </div>
                <Progress value={progress} className="h-2" />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Start Date</p>
                  <p className="font-medium">
                    {new Date(activeLoan.start_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">End Date</p>
                  <p className="font-medium">
                    {new Date(activeLoan.end_date).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Principal</p>
                  <p className="font-medium">
                    ₦
                    {((activeLoan.principal_cents || 0) / 100).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Interest Rate</p>
                  <p className="font-medium">
                    {activeLoan.interest_rate}% per year
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Repayment Schedule */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Schedule</CardTitle>
            <CardDescription>Your monthly repayment timeline</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading repayment schedule...
              </div>
            ) : loanRepayments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No active repayments</p>
                <p className="text-sm mt-2">
                  Your repayment schedule will appear here once you have an
                  approved loan
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {loanRepayments.map((repayment, index) => (
                  <div
                    key={repayment.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold">{index + 1}</p>
                        <p className="text-xs text-muted-foreground">Payment</p>
                      </div>
                      <div>
                        <p className="font-medium">
                          ₦
                          {(
                            (repayment.amount_cents || 0) / 100
                          ).toLocaleString()}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Due{" "}
                          {new Date(repayment.due_date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {getStatusBadge(repayment.status)}
                      {repayment.paid_at && (
                        <span className="text-xs text-muted-foreground">
                          Paid{" "}
                          {new Date(repayment.paid_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Repayments;

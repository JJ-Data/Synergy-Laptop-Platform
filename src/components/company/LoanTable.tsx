import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Eye, User } from "lucide-react";
import { calculateLoanProgress } from "@/lib/finance";
import type { LoanWithDetails, RepaymentWithDetails } from "@/types/loan";

interface LoanTableProps {
  loans: LoanWithDetails[];
  repayments: RepaymentWithDetails[];
  loading: boolean;
  onViewDetails: (loan: LoanWithDetails) => void;
}

export const LoanTable = ({ loans, repayments, loading, onViewDetails }: LoanTableProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>All Company Loans</CardTitle>
        <CardDescription>Complete overview of employee financing</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading loans...</div>
        ) : loans.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No loans found</div>
        ) : (
          <div className="space-y-4">
            {loans.map((loan) => {
              const progress = calculateLoanProgress(repayments, loan.id);
              const loanRepayments = repayments.filter((r) => r.loan_id === loan.id);
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
                        <AvatarImage src={loan.profiles?.avatar_url || undefined} />
                        <AvatarFallback>
                          <User className="h-6 w-6" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium">
                          {loan.profiles?.display_name || "Unknown Employee"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {loan.requests.laptops.brand} {loan.requests.laptops.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Started {new Date(loan.start_date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-lg">
                        ₦{Math.round(loan.principal_cents / 100).toLocaleString()}
                      </div>
                      <Badge variant={loan.status === "active" ? "default" : "secondary"}>
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
                          ₦{Math.round(loan.principal_cents / 100).toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">Principal</div>
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <div className="text-sm font-medium">
                          ₦{remainingAmount.toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">Remaining</div>
                      </div>
                      <div className="p-2 bg-muted rounded">
                        <div className="text-sm font-medium">{loan.interest_rate}%</div>
                        <div className="text-xs text-muted-foreground">Interest</div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button variant="outline" size="sm" onClick={() => onViewDetails(loan)}>
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
  );
};

export default LoanTable;

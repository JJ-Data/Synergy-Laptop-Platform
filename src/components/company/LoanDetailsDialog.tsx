import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download } from "lucide-react";
import { calculateLoanProgress } from "@/lib/finance";
import type { LoanWithDetails, RepaymentWithDetails } from "@/types/loan";

interface LoanDetailsDialogProps {
  loan: LoanWithDetails | null;
  repayments: RepaymentWithDetails[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const LoanDetailsDialog = ({ loan, repayments, open, onOpenChange }: LoanDetailsDialogProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-4xl">
      <DialogHeader>
        <DialogTitle>Loan Details</DialogTitle>
        <DialogDescription>Complete loan and repayment information</DialogDescription>
      </DialogHeader>

      {loan && (
        <div className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Loan Information</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Employee:</span>
                  <span className="font-medium">
                    {loan.profiles?.display_name || "Unknown"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Device:</span>
                  <span className="font-medium">
                    {loan.requests.laptops.brand} {loan.requests.laptops.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Principal Amount:</span>
                  <span className="font-medium">
                    ₦{Math.round(loan.principal_cents / 100).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Interest Rate:</span>
                  <span className="font-medium">{loan.interest_rate}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Start Date:</span>
                  <span className="font-medium">
                    {new Date(loan.start_date).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>End Date:</span>
                  <span className="font-medium">
                    {new Date(loan.end_date).toLocaleDateString()}
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
                      {Math.round(calculateLoanProgress(repayments, loan.id))}%
                    </span>
                  </div>
                  <Progress value={calculateLoanProgress(repayments, loan.id)} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-center p-2 bg-green-50 rounded">
                    <div className="font-medium text-green-800">
                      {
                        repayments.filter(
                          (r) => r.loan_id === loan.id && r.status === "paid"
                        ).length
                      }
                    </div>
                    <div className="text-green-600">Paid</div>
                  </div>
                  <div className="text-center p-2 bg-orange-50 rounded">
                    <div className="font-medium text-orange-800">
                      {
                        repayments.filter(
                          (r) => r.loan_id === loan.id && r.status === "due"
                        ).length
                      }
                    </div>
                    <div className="text-orange-600">Remaining</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Repayment Schedule</h4>
            <div className="max-h-64 overflow-y-auto border rounded-lg">
              <div className="space-y-2 p-4">
                {repayments
                  .filter((r) => r.loan_id === loan.id)
                  .map((repayment) => (
                    <div
                      key={repayment.id}
                      className="flex justify-between items-center p-2 border rounded"
                    >
                      <div>
                        <div className="text-sm font-medium">
                          ₦{Math.round(repayment.amount_cents / 100).toLocaleString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Due: {new Date(repayment.due_date).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge variant={repayment.status === "paid" ? "default" : "secondary"}>
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
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Close
        </Button>
        <Button>
          <Download className="h-4 w-4 mr-2" />
          Export Details
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default LoanDetailsDialog;

import AppLayout from "@/components/layout/AppLayout";
import Seo from "@/components/seo/Seo";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/context/CompanyContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, Clock, Laptop } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const Requests = () => {
  const { companyId } = useCompany();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [action, setAction] = useState<"approve" | "reject" | null>(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ["requests", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("requests")
        .select(
          `
          *,
          laptops(name, brand, price_cents),
          profiles:employee_id(display_name)
        `
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: policy } = useQuery({
    queryKey: ["policy", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data } = await supabase
        .from("policies")
        .select("interest_rate")
        .eq("company_id", companyId)
        .single();
      return data;
    },
    enabled: !!companyId,
  });

  const handleRequestMutation = useMutation({
    mutationFn: async ({
      requestId,
      status,
    }: {
      requestId: string;
      status: "approved" | "rejected";
    }) => {
      // Update request status
      const { error: updateError } = await supabase
        .from("requests")
        .update({
          status,
          decided_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (updateError) throw updateError;

      // If approved, create loan and repayment schedule
      if (status === "approved" && policy) {
        const request = requests?.find((r) => r.id === requestId);
        if (!request) throw new Error("Request not found");

        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + request.duration_months);

        // Create loan
        const { data: loan, error: loanError } = await supabase
          .from("loans")
          .insert({
            company_id: companyId,
            employee_id: request.employee_id,
            request_id: requestId,
            principal_cents: request.requested_amount_cents,
            interest_rate: policy.interest_rate || 0,
            start_date: startDate.toISOString().split("T")[0],
            end_date: endDate.toISOString().split("T")[0],
            status: "active",
          })
          .select()
          .single();

        if (loanError) throw loanError;

        // Generate repayment schedule
        const monthlyRate = (policy.interest_rate || 0) / 100 / 12;
        const numPayments = request.duration_months;
        const principal = request.requested_amount_cents;

        let monthlyPayment: number;
        if (monthlyRate === 0) {
          monthlyPayment = Math.round(principal / numPayments);
        } else {
          monthlyPayment = Math.round(
            (principal * monthlyRate) /
              (1 - Math.pow(1 + monthlyRate, -numPayments))
          );
        }

        const repayments = [];
        for (let i = 1; i <= numPayments; i++) {
          const dueDate = new Date(startDate);
          dueDate.setMonth(dueDate.getMonth() + i);

          repayments.push({
            company_id: companyId,
            employee_id: request.employee_id,
            loan_id: loan.id,
            due_date: dueDate.toISOString().split("T")[0],
            amount_cents: monthlyPayment,
            status: "due",
          });
        }

        const { error: repaymentError } = await supabase
          .from("repayments")
          .insert(repayments);

        if (repaymentError) throw repaymentError;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      toast.success(
        `Request ${
          variables.status === "approved" ? "approved" : "rejected"
        } successfully`
      );
      setSelectedRequest(null);
      setAction(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to process request");
    },
  });

  const handleAction = (request: any, actionType: "approve" | "reject") => {
    setSelectedRequest(request);
    setAction(actionType);
  };

  const confirmAction = () => {
    if (selectedRequest && action) {
      handleRequestMutation.mutate({
        requestId: selectedRequest.id,
        status: action === "approve" ? "approved" : "rejected",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: { variant: "secondary" as const, icon: Clock },
      approved: { variant: "default" as const, icon: Check },
      rejected: { variant: "destructive" as const, icon: X },
    };
    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  if (!companyId) {
    return (
      <AppLayout title="Requests">
        <div className="text-center py-8 text-muted-foreground">
          No company context. Please log in as an admin.
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
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {requests?.filter((r) => r.status === "pending").length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Approved</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {requests?.filter((r) => r.status === "approved").length || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Total Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{requests?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        {/* Requests List */}
        <Card>
          <CardHeader>
            <CardTitle>Financing Requests</CardTitle>
            <CardDescription>
              Review and process employee financing requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading requests...
              </div>
            ) : requests?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Laptop className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No financing requests yet</p>
                <p className="text-sm mt-2">
                  Requests from employees will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {requests?.map((request) => (
                  <div key={request.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold">
                            {request.profiles?.display_name ||
                              "Unknown Employee"}
                          </h4>
                          {getStatusBadge(request.status)}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Device</p>
                            <p className="font-medium">
                              {request.laptops?.brand} {request.laptops?.name}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Amount</p>
                            <p className="font-medium">
                              ₦
                              {(
                                (request.requested_amount_cents || 0) / 100
                              ).toLocaleString()}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Duration</p>
                            <p className="font-medium">
                              {request.duration_months} months
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          Requested on{" "}
                          {new Date(request.created_at).toLocaleDateString()}
                        </div>
                      </div>
                      {request.status === "pending" && (
                        <div className="flex gap-2 ml-4">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleAction(request, "approve")}
                            disabled={handleRequestMutation.isPending}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAction(request, "reject")}
                            disabled={handleRequestMutation.isPending}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog
        open={!!selectedRequest && !!action}
        onOpenChange={() => {
          setSelectedRequest(null);
          setAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {action === "approve" ? "Approve Request?" : "Reject Request?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {action === "approve"
                ? "This will create a loan and repayment schedule for the employee."
                : "This will reject the financing request. The employee will need to submit a new request."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction}>
              {action === "approve" ? "Approve" : "Reject"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Requests;

// src/pages/company/RequestsDashboard.tsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import AppLayout from "@/components/layout/AppLayout";
import { useCompany } from "@/context/CompanyContext";
import { RequestService } from "@/services/requestService";
import { supabase } from "@/lib/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  Calendar,
  Laptop,
  TrendingUp,
  AlertCircle,
  FileText,
} from "lucide-react";

const RequestsDashboard = () => {
  const { companyId, company } = useCompany();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Fetch all requests
  const { data: allRequests = [], isLoading } = useQuery({
    queryKey: ["company-requests", companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data, error } = await supabase
        .from("requests")
        .select(
          `
          *,
          laptops(name, brand, price_cents, image_url),
          profiles!requests_employee_id_fkey(display_name, avatar_url)
        `
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Filter requests by status
  const pendingRequests = allRequests.filter((r) => r.status === "pending");
  const approvedRequests = allRequests.filter((r) => r.status === "approved");
  const rejectedRequests = allRequests.filter((r) => r.status === "rejected");

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: (requestId: string) =>
      RequestService.approveRequest(requestId, companyId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-requests"] });
      toast.success("Request approved and loan created successfully!");
      setShowDetailsModal(false);
    },
    onError: (error) => {
      toast.error("Failed to approve request: " + error.message);
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: (requestId: string) => RequestService.rejectRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-requests"] });
      toast.success("Request rejected");
      setShowDetailsModal(false);
    },
    onError: (error) => {
      toast.error("Failed to reject request: " + error.message);
    },
  });

  const openRequestDetails = (request: any) => {
    setSelectedRequest(request);
    setShowDetailsModal(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  // Calculate stats
  const stats = {
    pending: pendingRequests.length,
    approved: approvedRequests.length,
    rejected: rejectedRequests.length,
    totalValue:
      pendingRequests.reduce(
        (sum, r) => sum + (r.requested_amount_cents || 0),
        0
      ) / 100,
  };

  if (!companyId) {
    return (
      <AppLayout title="Requests">
        <div className="text-center py-8 text-muted-foreground">
          No company context available
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Financing Requests">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Financing Requests</h1>
          <p className="text-muted-foreground">
            Review and manage employee laptop financing requests
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.pending}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.approved}</p>
                  <p className="text-sm text-muted-foreground">Approved</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <XCircle className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.rejected}</p>
                  <p className="text-sm text-muted-foreground">Rejected</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">
                    ₦{stats.totalValue.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Pending Value</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Requests Tabs */}
        <Tabs defaultValue="pending">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pending">
              Pending ({pendingRequests.length})
            </TabsTrigger>
            <TabsTrigger value="approved">
              Approved ({approvedRequests.length})
            </TabsTrigger>
            <TabsTrigger value="rejected">
              Rejected ({rejectedRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            {pendingRequests.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                  <p className="text-lg font-medium">All caught up!</p>
                  <p className="text-muted-foreground">
                    No pending requests at the moment
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pendingRequests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    onViewDetails={() => openRequestDetails(request)}
                    onApprove={() => approveMutation.mutate(request.id)}
                    onReject={() => rejectMutation.mutate(request.id)}
                    isPending={
                      approveMutation.isPending || rejectMutation.isPending
                    }
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-4">
            {approvedRequests.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No approved requests yet
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {approvedRequests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    onViewDetails={() => openRequestDetails(request)}
                    isReadOnly
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="rejected" className="space-y-4">
            {rejectedRequests.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-muted-foreground">No rejected requests</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {rejectedRequests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    onViewDetails={() => openRequestDetails(request)}
                    isReadOnly
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Request Details Modal */}
        {selectedRequest && (
          <RequestDetailsModal
            request={selectedRequest}
            open={showDetailsModal}
            onOpenChange={setShowDetailsModal}
            onApprove={() => approveMutation.mutate(selectedRequest.id)}
            onReject={() => rejectMutation.mutate(selectedRequest.id)}
            isPending={approveMutation.isPending || rejectMutation.isPending}
          />
        )}
      </div>
    </AppLayout>
  );
};

// Request Card Component
const RequestCard = ({
  request,
  onViewDetails,
  onApprove,
  onReject,
  isPending,
  isReadOnly,
}: any) => {
  const monthlyPayment = RequestService.calculateMonthlyPayment(
    request.requested_amount_cents / 100,
    request.duration_months,
    0 // You can fetch actual interest rate here
  );

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex gap-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={request.profiles?.avatar_url} />
              <AvatarFallback>
                {request.profiles?.display_name?.[0] || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <div className="font-semibold">
                {request.profiles?.display_name || "Unknown Employee"}
              </div>
              <div className="text-sm text-muted-foreground">
                {request.laptops?.brand} {request.laptops?.name}
              </div>
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <DollarSign className="h-3 w-3" />₦
                  {(request.requested_amount_cents / 100).toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {request.duration_months} months
                </span>
                <span className="flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />₦
                  {monthlyPayment.toLocaleString()}/mo
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={
                request.status === "pending"
                  ? "secondary"
                  : request.status === "approved"
                  ? "default"
                  : "destructive"
              }
            >
              {request.status}
            </Badge>
            {!isReadOnly && request.status === "pending" && (
              <>
                <Button
                  size="sm"
                  variant="default"
                  onClick={onApprove}
                  disabled={isPending}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={onReject}
                  disabled={isPending}
                >
                  Reject
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" onClick={onViewDetails}>
              View Details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Request Details Modal Component
const RequestDetailsModal = ({
  request,
  open,
  onOpenChange,
  onApprove,
  onReject,
  isPending,
}: any) => {
  const monthlyPayment = RequestService.calculateMonthlyPayment(
    request.requested_amount_cents / 100,
    request.duration_months,
    5 // Assuming 5% interest rate
  );

  const totalPayment = monthlyPayment * request.duration_months;
  const interestAmount = totalPayment - request.requested_amount_cents / 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Request Details</DialogTitle>
          <DialogDescription>
            Review complete information about this financing request
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Employee Information */}
          <div>
            <h4 className="font-medium mb-3">Employee Information</h4>
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={request.profiles?.avatar_url} />
                <AvatarFallback>
                  {request.profiles?.display_name?.[0] || "?"}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium text-lg">
                  {request.profiles?.display_name || "Unknown Employee"}
                </div>
                <div className="text-sm text-muted-foreground">
                  Employee ID: {request.employee_id.slice(0, 8)}...
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Device Information */}
          <div>
            <h4 className="font-medium mb-3">Device Information</h4>
            <div className="flex gap-4">
              {request.laptops?.image_url && (
                <img
                  src={request.laptops.image_url}
                  alt={request.laptops.name}
                  className="w-24 h-24 object-cover rounded-lg"
                />
              )}
              <div className="space-y-2">
                <div className="font-medium">
                  {request.laptops?.brand} {request.laptops?.name}
                </div>
                <div className="text-sm text-muted-foreground">
                  Price: ₦
                  {((request.laptops?.price_cents || 0) / 100).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Financing Details */}
          <div>
            <h4 className="font-medium mb-3">Financing Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Requested Amount
                </p>
                <p className="font-medium">
                  ₦{(request.requested_amount_cents / 100).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duration</p>
                <p className="font-medium">{request.duration_months} months</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Payment</p>
                <p className="font-medium">
                  ₦{monthlyPayment.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  Total with Interest
                </p>
                <p className="font-medium">₦{totalPayment.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Interest Amount</p>
                <p className="font-medium">
                  ₦{interestAmount.toLocaleString()} (5% APR)
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Request Date</p>
                <p className="font-medium">
                  {new Date(request.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {request.status === "pending" && (
            <>
              <Button
                variant="destructive"
                onClick={onReject}
                disabled={isPending}
              >
                Reject Request
              </Button>
              <Button onClick={onApprove} disabled={isPending}>
                Approve & Create Loan
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RequestsDashboard;

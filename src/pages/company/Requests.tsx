// src/pages/company/Requests.tsx - Fixed version
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
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/context/CompanyContext";
import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  Laptop,
  Calendar,
  DollarSign,
  FileText,
  Eye,
  AlertTriangle,
  TrendingUp,
  Filter,
} from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

// Enhanced request type with relations - FIXED foreign key relationships
type RequestWithDetails = {
  id: string;
  status: string;
  requested_amount_cents: number;
  duration_months: number;
  created_at: string;
  decided_at?: string;
  employee_id: string;
  laptop_id: string;
  // Fixed: Use proper nested selection
  laptop?: {
    name: string;
    brand: string;
    price_cents: number;
    image_url?: string;
    cpu?: string;
    ram_gb?: number;
    storage_gb?: number;
  };
  employee_profile?: {
    display_name?: string;
    avatar_url?: string;
  };
};

// Helper function to calculate monthly payment
function calculateMonthlyPayment(
  principal: number,
  months: number,
  annualRate: number
): number {
  if (annualRate === 0) return principal / months;
  const monthlyRate = annualRate / 100 / 12;
  const payment =
    (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
  return Math.round(payment);
}

// Helper function to get status info
function getStatusInfo(status: string) {
  switch (status) {
    case "pending":
      return {
        color: "bg-yellow-100 text-yellow-800 border-yellow-200",
        icon: Clock,
        label: "Pending Review",
        variant: "secondary" as const,
      };
    case "approved":
      return {
        color: "bg-green-100 text-green-800 border-green-200",
        icon: CheckCircle,
        label: "Approved",
        variant: "default" as const,
      };
    case "rejected":
      return {
        color: "bg-red-100 text-red-800 border-red-200",
        icon: XCircle,
        label: "Rejected",
        variant: "destructive" as const,
      };
    case "purchased":
      return {
        color: "bg-blue-100 text-blue-800 border-blue-200",
        icon: CheckCircle,
        label: "Purchased",
        variant: "default" as const,
      };
    default:
      return {
        color: "bg-gray-100 text-gray-800 border-gray-200",
        icon: AlertTriangle,
        label: "Unknown",
        variant: "outline" as const,
      };
  }
}

const Requests = () => {
  const { companyId, company } = useCompany();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] =
    useState<RequestWithDetails | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [actionRequest, setActionRequest] = useState<{
    request: RequestWithDetails;
    action: "approve" | "reject";
  } | null>(null);
  const [activeTab, setActiveTab] = useState("pending");

  // Fetch company policy for calculations
  const { data: policy } = useQuery({
    queryKey: ["policy", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("policies")
        .select("interest_rate")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // FIXED: Simplified query with better error handling
  const {
    data: requests = [],
    isLoading,
    error: requestsError,
  } = useQuery({
    queryKey: ["company-requests", companyId],
    queryFn: async () => {
      if (!companyId) return [];

      console.log("Fetching requests for company:", companyId);

      // First get basic requests
      const { data: requestsData, error: requestsError } = await supabase
        .from("requests")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (requestsError) {
        console.error("Error fetching requests:", requestsError);
        throw requestsError;
      }

      console.log("Found requests:", requestsData?.length || 0);

      if (!requestsData || requestsData.length === 0) {
        return [];
      }

      // Get laptop details for each request
      const laptopIds = [...new Set(requestsData.map((r) => r.laptop_id))];
      const { data: laptopsData, error: laptopsError } = await supabase
        .from("laptops")
        .select(
          "id, name, brand, price_cents, image_url, cpu, ram_gb, storage_gb"
        )
        .in("id", laptopIds);

      if (laptopsError) {
        console.error("Error fetching laptops:", laptopsError);
        // Don't throw - we can still show requests without laptop details
      }

      // Get employee profiles for each request
      const employeeIds = [...new Set(requestsData.map((r) => r.employee_id))];
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url")
        .in("id", employeeIds);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        // Don't throw - we can still show requests without profile details
      }

      // Combine the data
      const enrichedRequests: RequestWithDetails[] = requestsData.map(
        (request) => {
          const laptop = laptopsData?.find((l) => l.id === request.laptop_id);
          const profile = profilesData?.find(
            (p) => p.id === request.employee_id
          );

          return {
            ...request,
            laptop: laptop
              ? {
                  name: laptop.name,
                  brand: laptop.brand || "",
                  price_cents: laptop.price_cents,
                  image_url: laptop.image_url || undefined,
                  cpu: laptop.cpu || undefined,
                  ram_gb: laptop.ram_gb || undefined,
                  storage_gb: laptop.storage_gb || undefined,
                }
              : undefined,
            employee_profile: profile
              ? {
                  display_name: profile.display_name || undefined,
                  avatar_url: profile.avatar_url || undefined,
                }
              : undefined,
          };
        }
      );

      console.log("Enriched requests:", enrichedRequests.length);
      return enrichedRequests;
    },
    enabled: !!companyId,
    retry: 3,
    retryDelay: 1000,
  });

  // Update request status mutation with loan creation
  const updateRequestMutation = useMutation({
    mutationFn: async ({
      requestId,
      status,
    }: {
      requestId: string;
      status: "approved" | "rejected";
    }) => {
      const request = requests.find((r) => r.id === requestId);
      if (!request) throw new Error("Request not found");

      // Update request status
      const { error: requestError } = await supabase
        .from("requests")
        .update({
          status,
          decided_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (requestError) throw requestError;

      // If approved, create loan and repayment schedule
      if (status === "approved") {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setMonth(startDate.getMonth() + request.duration_months);

        // Create loan
        const { data: loanData, error: loanError } = await supabase
          .from("loans")
          .insert([
            {
              company_id: companyId!,
              employee_id: request.employee_id,
              request_id: requestId,
              principal_cents: request.requested_amount_cents,
              interest_rate: interestRate,
              start_date: startDate.toISOString().split("T")[0],
              end_date: endDate.toISOString().split("T")[0],
              status: "active",
            },
          ])
          .select()
          .single();

        if (loanError) throw loanError;

        // Generate repayment schedule
        const monthlyAmount = calculateMonthlyPayment(
          request.requested_amount_cents / 100,
          request.duration_months,
          interestRate
        );

        const repayments = [];
        for (let i = 0; i < request.duration_months; i++) {
          const dueDate = new Date(startDate);
          dueDate.setMonth(dueDate.getMonth() + i + 1);

          repayments.push({
            company_id: companyId!,
            employee_id: request.employee_id,
            loan_id: loanData.id,
            due_date: dueDate.toISOString().split("T")[0],
            amount_cents: Math.round(monthlyAmount * 100),
            status: "due",
          });
        }

        const { error: repaymentsError } = await supabase
          .from("repayments")
          .insert(repayments);

        if (repaymentsError) throw repaymentsError;
      }
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["company-requests"] });
      if (status === "approved") {
        toast.success("Request approved and loan created successfully!");
      } else {
        toast.success("Request rejected successfully");
      }
      setActionRequest(null);
    },
    onError: (error) => {
      console.error("Update request error:", error);
      toast.error("Failed to update request: " + error.message);
    },
  });

  const handleRequestAction = (
    request: RequestWithDetails,
    action: "approve" | "reject"
  ) => {
    setActionRequest({ request, action });
  };

  const confirmAction = () => {
    if (!actionRequest) return;
    updateRequestMutation.mutate({
      requestId: actionRequest.request.id,
      status: actionRequest.action,
    });
  };

  const openRequestDetails = (request: RequestWithDetails) => {
    setSelectedRequest(request);
    setIsDetailsDialogOpen(true);
  };

  // Filter requests by status
  const filteredRequests = requests.filter((request) => {
    if (activeTab === "all") return true;
    return request.status === activeTab;
  });

  // Calculate stats
  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

  const interestRate = policy?.interest_rate ?? 0;

  // Debug logging
  console.log("Requests page debug:", {
    companyId,
    company: company?.name,
    requestsCount: requests.length,
    isLoading,
    error: requestsError,
    stats,
  });

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
    <AppLayout title="Financing Requests">
      <Seo
        title="Requests | Company Admin"
        description="Review and approve employee device financing requests."
      />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Financing Requests</h1>
            <p className="text-muted-foreground">
              Review and manage employee laptop financing applications
            </p>
          </div>
        </div>

        {/* Debug info for troubleshooting */}
        {process.env.NODE_ENV === "development" && (
          <Card className="border-dashed border-yellow-200 bg-yellow-50">
            <CardContent className="p-4">
              <details>
                <summary className="text-sm font-medium cursor-pointer">
                  Debug Info
                </summary>
                <pre className="text-xs mt-2 overflow-auto">
                  {JSON.stringify(
                    {
                      companyId,
                      companyName: company?.name,
                      requestsCount: requests.length,
                      isLoading,
                      error: requestsError?.message,
                      stats,
                    },
                    null,
                    2
                  )}
                </pre>
              </details>
            </CardContent>
          </Card>
        )}

        {/* Error display */}
        {requestsError && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-800">
                <AlertTriangle className="h-5 w-5" />
                <div>
                  <h3 className="font-semibold">Error Loading Requests</h3>
                  <p className="text-sm">{requestsError.message}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <div className="text-sm font-medium">Total</div>
              </div>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-600" />
                <div className="text-sm font-medium">Pending</div>
              </div>
              <div className="text-2xl font-bold">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <div className="text-sm font-medium">Approved</div>
              </div>
              <div className="text-2xl font-bold">{stats.approved}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                <div className="text-sm font-medium">Rejected</div>
              </div>
              <div className="text-2xl font-bold">{stats.rejected}</div>
            </CardContent>
          </Card>
        </div>

        {/* Requests Table with Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Request Management</CardTitle>
            <CardDescription>
              Filter and review employee financing requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="approved">Approved</TabsTrigger>
                <TabsTrigger value="rejected">Rejected</TabsTrigger>
                <TabsTrigger value="purchased">Purchased</TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>

              <TabsContent value={activeTab} className="space-y-4 mt-6">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading requests...
                  </div>
                ) : filteredRequests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No {activeTab === "all" ? "" : activeTab + " "}requests
                    found
                    {requests.length === 0 && (
                      <div className="mt-2">
                        <p className="text-sm">
                          No requests have been submitted yet.
                        </p>
                        <p className="text-xs mt-1">
                          Requests will appear here once employees submit
                          financing applications.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredRequests.map((request) => {
                      const statusInfo = getStatusInfo(request.status);
                      const StatusIcon = statusInfo.icon;
                      const monthlyPayment = calculateMonthlyPayment(
                        request.requested_amount_cents / 100,
                        request.duration_months,
                        interestRate
                      );

                      return (
                        <div
                          key={request.id}
                          className="border rounded-lg p-6 hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex gap-4 flex-1">
                              {/* Employee Info */}
                              <div className="flex items-center gap-3">
                                <Avatar className="h-12 w-12">
                                  <AvatarImage
                                    src={
                                      request.employee_profile?.avatar_url ||
                                      undefined
                                    }
                                  />
                                  <AvatarFallback>
                                    <User className="h-6 w-6" />
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-medium">
                                    {request.employee_profile?.display_name ||
                                      "Unknown Employee"}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    Submitted{" "}
                                    {new Date(
                                      request.created_at
                                    ).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>

                              {/* Request Details */}
                              <div className="flex-1 grid md:grid-cols-3 gap-4 min-w-0">
                                {/* Laptop Info */}
                                <div className="flex gap-3">
                                  <div className="w-16 h-16 bg-muted rounded-lg flex-shrink-0 overflow-hidden">
                                    <img
                                      src={
                                        request.laptop?.image_url ||
                                        "/placeholder.svg"
                                      }
                                      alt={request.laptop?.name || "Laptop"}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-medium truncate">
                                      {request.laptop?.brand}{" "}
                                      {request.laptop?.name || "Unknown Laptop"}
                                    </div>
                                    <div className="text-sm text-muted-foreground">
                                      ₦
                                      {Math.round(
                                        request.requested_amount_cents / 100
                                      ).toLocaleString()}
                                    </div>
                                  </div>
                                </div>

                                {/* Financial Details */}
                                <div>
                                  <div className="text-sm text-muted-foreground">
                                    Monthly Payment
                                  </div>
                                  <div className="font-semibold">
                                    ₦{monthlyPayment.toLocaleString()}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    {request.duration_months} months
                                  </div>
                                </div>

                                {/* Status */}
                                <div>
                                  <Badge
                                    variant={statusInfo.variant}
                                    className={statusInfo.color}
                                  >
                                    <StatusIcon className="h-3 w-3 mr-1" />
                                    {statusInfo.label}
                                  </Badge>
                                  {request.decided_at && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Decided{" "}
                                      {new Date(
                                        request.decided_at
                                      ).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 ml-4">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openRequestDetails(request)}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                Details
                              </Button>

                              {request.status === "pending" && (
                                <>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() =>
                                      handleRequestAction(request, "approve")
                                    }
                                  >
                                    <CheckCircle className="h-4 w-4 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() =>
                                      handleRequestAction(request, "reject")
                                    }
                                  >
                                    <XCircle className="h-4 w-4 mr-1" />
                                    Reject
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Request Details Modal */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
            <DialogDescription>
              Complete information about this financing request
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-6">
              {/* Employee Section */}
              <div>
                <h4 className="font-medium mb-3">Employee Information</h4>
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  <Avatar className="h-12 w-12">
                    <AvatarImage
                      src={
                        selectedRequest.employee_profile?.avatar_url ||
                        undefined
                      }
                    />
                    <AvatarFallback>
                      <User className="h-6 w-6" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">
                      {selectedRequest.employee_profile?.display_name ||
                        "Unknown Employee"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Employee ID: {selectedRequest.employee_id.slice(0, 8)}...
                    </div>
                  </div>
                </div>
              </div>

              {/* Laptop Section */}
              <div>
                <h4 className="font-medium mb-3">Requested Device</h4>
                <div className="flex gap-4 p-3 bg-muted rounded-lg">
                  <div className="w-20 h-20 bg-background rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={
                        selectedRequest.laptop?.image_url || "/placeholder.svg"
                      }
                      alt={selectedRequest.laptop?.name || "Laptop"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">
                      {selectedRequest.laptop?.brand}{" "}
                      {selectedRequest.laptop?.name || "Unknown Laptop"}
                    </div>
                    {selectedRequest.laptop && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {[
                          selectedRequest.laptop.cpu,
                          selectedRequest.laptop.ram_gb
                            ? `${selectedRequest.laptop.ram_gb}GB RAM`
                            : null,
                          selectedRequest.laptop.storage_gb
                            ? `${selectedRequest.laptop.storage_gb}GB Storage`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" • ")}
                      </div>
                    )}
                    <div className="text-lg font-semibold mt-2">
                      ₦
                      {Math.round(
                        selectedRequest.requested_amount_cents / 100
                      ).toLocaleString()}
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Details */}
              <div>
                <h4 className="font-medium mb-3">Financial Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b">
                      <span>Loan Amount</span>
                      <span className="font-semibold">
                        ₦
                        {Math.round(
                          selectedRequest.requested_amount_cents / 100
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span>Duration</span>
                      <span>{selectedRequest.duration_months} months</span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span>Interest Rate</span>
                      <span>{interestRate}% APR</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between py-2 border-b">
                      <span>Monthly Payment</span>
                      <span className="font-semibold">
                        ₦
                        {calculateMonthlyPayment(
                          selectedRequest.requested_amount_cents / 100,
                          selectedRequest.duration_months,
                          interestRate
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span>Total Amount</span>
                      <span>
                        ₦
                        {(
                          calculateMonthlyPayment(
                            selectedRequest.requested_amount_cents / 100,
                            selectedRequest.duration_months,
                            interestRate
                          ) * selectedRequest.duration_months
                        ).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-b">
                      <span>Total Interest</span>
                      <span>
                        ₦
                        {(
                          calculateMonthlyPayment(
                            selectedRequest.requested_amount_cents / 100,
                            selectedRequest.duration_months,
                            interestRate
                          ) *
                            selectedRequest.duration_months -
                          selectedRequest.requested_amount_cents / 100
                        ).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status and Timeline */}
              <div>
                <h4 className="font-medium mb-3">Request Status</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">
                      Submitted:{" "}
                      {new Date(selectedRequest.created_at).toLocaleString()}
                    </span>
                  </div>
                  {selectedRequest.decided_at && (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        Decided:{" "}
                        {new Date(selectedRequest.decided_at).toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="mt-3">
                    {(() => {
                      const statusInfo = getStatusInfo(selectedRequest.status);
                      const StatusIcon = statusInfo.icon;
                      return (
                        <Badge
                          variant={statusInfo.variant}
                          className={statusInfo.color}
                        >
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusInfo.label}
                        </Badge>
                      );
                    })()}
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
            {selectedRequest?.status === "pending" && (
              <>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setIsDetailsDialogOpen(false);
                    handleRequestAction(selectedRequest, "reject");
                  }}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Reject
                </Button>
                <Button
                  onClick={() => {
                    setIsDetailsDialogOpen(false);
                    handleRequestAction(selectedRequest, "approve");
                  }}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Confirmation Dialog */}
      <AlertDialog
        open={!!actionRequest}
        onOpenChange={() => setActionRequest(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionRequest?.action === "approve"
                ? "Approve Request"
                : "Reject Request"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionRequest?.action === "approve"
                ? "This will approve the financing request and allow the employee to proceed with the loan."
                : "This will reject the financing request. The employee will be notified of the decision."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmAction}
              disabled={updateRequestMutation.isPending}
              className={
                actionRequest?.action === "reject"
                  ? "bg-destructive hover:bg-destructive/90"
                  : ""
              }
            >
              {updateRequestMutation.isPending
                ? "Processing..."
                : actionRequest?.action === "approve"
                ? "Approve Request"
                : "Reject Request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Requests;

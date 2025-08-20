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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useCompany } from "@/context/CompanyContext";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  ShoppingCart,
  Calculator,
  CreditCard,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  FileText,
  Laptop,
} from "lucide-react";
import type { Tables } from "@/lib/supabase/types";

// Helper function to calculate monthly payment
function computeMonthly(
  price: number,
  months: number,
  interestRate: number
): number {
  if (interestRate === 0) return price / months;
  const monthlyRate = interestRate / 100 / 12;
  const payment =
    (price * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
  return Math.round(payment);
}

// Helper function to get status color and icon
function getRequestStatusInfo(status: string) {
  switch (status) {
    case "pending":
      return {
        color: "bg-yellow-100 text-yellow-800",
        icon: Clock,
        label: "Pending Review",
      };
    case "approved":
      return {
        color: "bg-green-100 text-green-800",
        icon: CheckCircle,
        label: "Approved",
      };
    case "rejected":
      return {
        color: "bg-red-100 text-red-800",
        icon: XCircle,
        label: "Rejected",
      };
    case "purchased":
      return {
        color: "bg-blue-100 text-blue-800",
        icon: CheckCircle,
        label: "Purchased",
      };
    default:
      return {
        color: "bg-gray-100 text-gray-800",
        icon: AlertCircle,
        label: "Unknown",
      };
  }
}

const EmployeePortal = () => {
  const { companyId } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedLaptopId, setSelectedLaptopId] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(12);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);

  // Fetch company policy
  const { data: policy } = useQuery({
    queryKey: ["policy", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("policies")
        .select("interest_rate, durations_months, max_amount_cents")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Fetch available laptops
  const { data: laptops, isLoading: loadingLaptops } = useQuery({
    queryKey: ["laptops", companyId],
    queryFn: async () => {
      if (!companyId) return [] as Tables<"laptops">[];
      const { data, error } = await supabase
        .from("laptops")
        .select("*")
        .eq("company_id", companyId)
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });

  // Fetch user's requests
  const { data: userRequests, isLoading: loadingRequests } = useQuery({
    queryKey: ["user-requests", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("requests")
        .select(
          `
          *,
          laptops(name, brand, price_cents, image_url)
        `
        )
        .eq("employee_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user?.id,
  });

  // Auto-select first laptop
  useEffect(() => {
    if (!selectedLaptopId && laptops && laptops.length > 0) {
      setSelectedLaptopId(laptops[0].id);
    }
  }, [laptops, selectedLaptopId]);

  // Submit financing request
  const submitRequestMutation = useMutation({
    mutationFn: async ({
      laptopId,
      duration,
    }: {
      laptopId: string;
      duration: number;
    }) => {
      if (!user?.id || !companyId)
        throw new Error("Missing user or company info");

      const laptop = laptops?.find((l) => l.id === laptopId);
      if (!laptop) throw new Error("Laptop not found");

      const { error } = await supabase.from("requests").insert([
        {
          company_id: companyId,
          employee_id: user.id,
          laptop_id: laptopId,
          requested_amount_cents: laptop.price_cents,
          duration_months: duration,
        },
      ]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-requests"] });
      toast.success("Financing request submitted successfully!");
      setIsRequestDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Failed to submit request: " + error.message);
    },
  });

  const selectedLaptop = useMemo(
    () => (laptops || []).find((l) => l.id === selectedLaptopId) || null,
    [laptops, selectedLaptopId]
  );

  const availableDurations =
    policy?.durations_months && policy.durations_months.length > 0
      ? policy.durations_months
      : [6, 12, 18];

  const interestRate = policy?.interest_rate ?? 0;

  const monthlyPayment = useMemo(() => {
    if (!selectedLaptop) return 0;
    const price = Math.round((selectedLaptop.price_cents ?? 0) / 100);
    return computeMonthly(price, selectedDuration, interestRate);
  }, [selectedLaptop, selectedDuration, interestRate]);

  const totalPayment = monthlyPayment * selectedDuration;
  const interestAmount =
    totalPayment -
    (selectedLaptop ? Math.round(selectedLaptop.price_cents / 100) : 0);

  const handleSubmitRequest = () => {
    if (!selectedLaptop) {
      toast.error("Please select a laptop first");
      return;
    }

    if (
      !policy?.max_amount_cents ||
      selectedLaptop.price_cents > policy.max_amount_cents
    ) {
      toast.error("Selected laptop exceeds maximum loan amount");
      return;
    }

    submitRequestMutation.mutate({
      laptopId: selectedLaptop.id,
      duration: selectedDuration,
    });
  };

  // Check if user has any pending requests
  const hasPendingRequest = userRequests?.some(
    (req) => req.status === "pending"
  );

  return (
    <AppLayout title="Employee Portal">
      <Seo
        title="Employee | Portal"
        description="Choose a laptop and repayment plan, track your status."
        canonical="/employee"
      />

      <div className="space-y-8">
        {/* Current Requests Status */}
        {userRequests && userRequests.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Your Financing Requests
              </CardTitle>
              <CardDescription>
                Track the status of your submitted requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {loadingRequests ? (
                  <div className="text-center py-4 text-muted-foreground">
                    Loading requests...
                  </div>
                ) : (
                  userRequests.map((request: any) => {
                    const statusInfo = getRequestStatusInfo(request.status);
                    const StatusIcon = statusInfo.icon;

                    return (
                      <div
                        key={request.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                            <Laptop className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="font-medium">
                              {request.laptops?.brand} {request.laptops?.name}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              ₦
                              {Math.round(
                                (request.requested_amount_cents || 0) / 100
                              ).toLocaleString()}{" "}
                              • {request.duration_months} months
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Submitted{" "}
                              {new Date(
                                request.created_at
                              ).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={statusInfo.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusInfo.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Selection Interface */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Laptop Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Available Laptops</CardTitle>
              <CardDescription>
                Company-approved devices for financing
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!companyId && (
                <div className="text-sm text-muted-foreground">
                  No company context.
                </div>
              )}
              {companyId && loadingLaptops && (
                <div className="text-center py-8 text-muted-foreground">
                  Loading laptops...
                </div>
              )}
              {companyId && !loadingLaptops && (laptops?.length ?? 0) === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No laptops available yet. Contact your admin.
                </div>
              )}
              {companyId && laptops && laptops.length > 0 && (
                <div className="grid gap-4">
                  {laptops.map((laptop) => (
                    <button
                      key={laptop.id}
                      onClick={() => setSelectedLaptopId(laptop.id)}
                      className={`text-left rounded-lg border p-4 transition-all hover:shadow-md ${
                        selectedLaptop?.id === laptop.id
                          ? "ring-2 ring-primary border-primary"
                          : "border-border"
                      }`}
                    >
                      <div className="flex gap-4">
                        <div className="w-20 h-20 bg-muted rounded-lg flex-shrink-0 overflow-hidden">
                          <img
                            src={laptop.image_url || "/placeholder.svg"}
                            alt={`${laptop.name} image`}
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {laptop.brand
                              ? `${laptop.brand} ${laptop.name}`
                              : laptop.name}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1">
                            {[
                              laptop.cpu,
                              laptop.ram_gb ? `${laptop.ram_gb}GB RAM` : null,
                              laptop.storage_gb
                                ? `${laptop.storage_gb}GB Storage`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          </div>
                          <div className="text-lg font-semibold mt-2">
                            ₦
                            {Math.round(
                              (laptop.price_cents ?? 0) / 100
                            ).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment Calculator */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Payment Calculator
              </CardTitle>
              <CardDescription>Configure your repayment plan</CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedLaptop ? (
                <div className="text-center py-8 text-muted-foreground">
                  Select a laptop to see payment details
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <div className="text-sm text-muted-foreground mb-2">
                      Selected Device
                    </div>
                    <div className="font-semibold">
                      {selectedLaptop.brand
                        ? `${selectedLaptop.brand} ${selectedLaptop.name}`
                        : selectedLaptop.name}
                    </div>
                    <div className="text-2xl font-bold mt-1">
                      ₦
                      {Math.round(
                        (selectedLaptop.price_cents ?? 0) / 100
                      ).toLocaleString()}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground mb-3">
                      Repayment Duration
                    </div>
                    <Select
                      value={selectedDuration.toString()}
                      onValueChange={(v) => setSelectedDuration(parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDurations.map((duration: number) => (
                          <SelectItem
                            key={duration}
                            value={duration.toString()}
                          >
                            {duration} months
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Monthly Payment</span>
                      <span className="font-semibold text-lg">
                        ₦{monthlyPayment.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-sm">
                      <span>Total Amount</span>
                      <span>₦{totalPayment.toLocaleString()}</span>
                    </div>

                    {interestRate > 0 && (
                      <div className="flex justify-between items-center text-sm">
                        <span>Interest ({interestRate}% APR)</span>
                        <span>₦{interestAmount.toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="hero"
                    className="w-full"
                    onClick={() => setIsRequestDialogOpen(true)}
                    disabled={hasPendingRequest}
                  >
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    {hasPendingRequest
                      ? "Request Pending"
                      : "Request Financing"}
                  </Button>

                  {hasPendingRequest && (
                    <div className="text-sm text-muted-foreground text-center">
                      You have a pending request. Please wait for approval
                      before submitting another.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Policy Information */}
        {policy && (
          <Card>
            <CardHeader>
              <CardTitle>Financing Information</CardTitle>
              <CardDescription>Your company's financing terms</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    ₦
                    {Math.round(policy.max_amount_cents / 100).toLocaleString()}
                  </div>
                  <div className="text-sm text-blue-700">Maximum Loan</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {policy.interest_rate}%
                  </div>
                  <div className="text-sm text-green-700">Annual Interest</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {availableDurations.length}
                  </div>
                  <div className="text-sm text-purple-700">
                    Duration Options
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Request Confirmation Dialog */}
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Financing Request</DialogTitle>
            <DialogDescription>
              Review your selection before submitting
            </DialogDescription>
          </DialogHeader>

          {selectedLaptop && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-16 h-16 bg-muted rounded-lg flex-shrink-0 overflow-hidden">
                  <img
                    src={selectedLaptop.image_url || "/placeholder.svg"}
                    alt={selectedLaptop.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <div className="font-medium">
                    {selectedLaptop.brand} {selectedLaptop.name}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    ₦
                    {Math.round(
                      selectedLaptop.price_cents / 100
                    ).toLocaleString()}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Duration:</span>
                  <span>{selectedDuration} months</span>
                </div>
                <div className="flex justify-between">
                  <span>Monthly Payment:</span>
                  <span className="font-semibold">
                    ₦{monthlyPayment.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Total Amount:</span>
                  <span>₦{totalPayment.toLocaleString()}</span>
                </div>
                {interestRate > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Interest:</span>
                    <span>₦{interestAmount.toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsRequestDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitRequest}
              disabled={submitRequestMutation.isPending}
            >
              {submitRequestMutation.isPending
                ? "Submitting..."
                : "Submit Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default EmployeePortal;

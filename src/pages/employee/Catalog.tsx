// src/pages/employee/Catalog.tsx
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/context/CompanyContext";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  ShoppingCart,
  Calculator,
  Laptop,
  AlertCircle,
  Building,
  User,
  DollarSign,
  Clock,
} from "lucide-react";

// Helper function to calculate monthly payment
function calculateMonthlyPayment(
  principal: number,
  months: number,
  annualRate: number
): number {
  if (annualRate === 0) return Math.round(principal / months);
  const monthlyRate = annualRate / 100 / 12;
  const payment =
    (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
  return Math.round(payment);
}

const Catalog = () => {
  const { companyId, company, loading: companyLoading } = useCompany();
  const { user } = useAuth();
  const [selectedLaptopId, setSelectedLaptopId] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState(12);

  // Debug: Log context values
  console.log("Employee Catalog Debug:", {
    companyId,
    company,
    user,
    userRole: user?.role,
    userCompanyId: user?.companyId,
  });

  // Fetch company policy
  const { data: policy } = useQuery({
    queryKey: ["policy", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      console.log("Fetching policy for company:", companyId);
      const { data, error } = await supabase
        .from("policies")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();

      console.log("Policy query result:", { data, error });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Fetch available laptops
  const {
    data: laptops,
    isLoading: loadingLaptops,
    error: laptopsError,
  } = useQuery({
    queryKey: ["employee-laptops", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      console.log("Fetching laptops for company:", companyId);

      const { data, error } = await supabase
        .from("laptops")
        .select("*")
        .eq("company_id", companyId)
        .eq("active", true)
        .order("created_at", { ascending: false });

      console.log("Laptops query result:", {
        data,
        error,
        count: data?.length,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
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
    return calculateMonthlyPayment(price, selectedDuration, interestRate);
  }, [selectedLaptop, selectedDuration, interestRate]);

  const totalPayment = monthlyPayment * selectedDuration;
  const interestAmount =
    totalPayment -
    (selectedLaptop ? Math.round(selectedLaptop.price_cents / 100) : 0);

  const handleSelectLaptop = (laptopId: string) => {
    setSelectedLaptopId(laptopId);
  };

  const handleRequestFinancing = () => {
    if (!selectedLaptop) {
      toast.error("Please select a laptop first");
      return;
    }
    // Navigate to main employee portal for request submission
    window.location.href = "/employee";
  };

  // Loading state
  if (companyLoading) {
    return (
      <AppLayout title="Catalog">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Clock className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading your catalog...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // No company context
  if (!companyId || !user) {
    return (
      <AppLayout title="Catalog">
        <Seo
          title="Catalog | Employee"
          description="Browse laptops available for financing."
        />
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Unable to load your company information. Please contact your
            administrator.
            <details className="mt-2 text-xs">
              <summary>Debug Info</summary>
              <pre className="mt-1 text-xs">
                User: {user ? "Logged in" : "Not logged in"}
                Company ID: {companyId || "None"}
                User Role: {user?.role || "None"}
                User Company ID: {user?.companyId || "None"}
              </pre>
            </details>
          </AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Device Catalog">
      <Seo
        title="Catalog | Employee"
        description="Browse laptops available for financing based on company policies."
        canonical="/employee/catalog"
      />

      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Device Catalog</h1>
          <p className="text-muted-foreground">
            Explore laptops approved for financing by {company?.name}
          </p>
        </div>

        {/* Company Context Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Building className="h-5 w-5 text-blue-600" />
              <div>
                <div className="font-medium">{company?.name}</div>
                <div className="text-sm text-muted-foreground">
                  Logged in as: {user.name} ({user.role})
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Policy Information */}
        {policy && (
          <Card>
            <CardHeader>
              <CardTitle>Financing Terms</CardTitle>
              <CardDescription>
                Your company's approved financing options
              </CardDescription>
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
                    {availableDurations.join(", ")}
                  </div>
                  <div className="text-sm text-purple-700">
                    Months Available
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error handling */}
        {laptopsError && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Error loading laptops: {laptopsError.message}
            </AlertDescription>
          </Alert>
        )}

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Laptop Catalog */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Available Laptops</CardTitle>
                <CardDescription>
                  Company-approved devices for employee financing
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingLaptops ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                    Loading available laptops...
                  </div>
                ) : !laptops || laptops.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Laptop className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">
                      No Laptops Available
                    </p>
                    <p className="text-sm">
                      Your company hasn't added any laptops to the catalog yet.
                      Contact your administrator to add devices.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {laptops.map((laptop) => (
                      <button
                        key={laptop.id}
                        onClick={() => handleSelectLaptop(laptop.id)}
                        className={`w-full text-left rounded-lg border p-4 transition-all hover:shadow-md ${
                          selectedLaptop?.id === laptop.id
                            ? "ring-2 ring-primary border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50"
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
                            <div className="font-medium text-lg truncate">
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
                            <div className="text-xl font-bold mt-2 text-primary">
                              ₦
                              {Math.round(
                                (laptop.price_cents ?? 0) / 100
                              ).toLocaleString()}
                            </div>
                            {policy && (
                              <div className="text-sm text-muted-foreground mt-1">
                                From ₦
                                {calculateMonthlyPayment(
                                  Math.round((laptop.price_cents ?? 0) / 100),
                                  Math.max(...availableDurations),
                                  interestRate
                                ).toLocaleString()}
                                /month
                              </div>
                            )}
                          </div>
                          {selectedLaptop?.id === laptop.id && (
                            <div className="flex items-center">
                              <Badge>Selected</Badge>
                            </div>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment Calculator */}
          <div className="lg:col-span-1">
            <Card className="sticky top-6">
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
                    <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Select a laptop to see payment details</p>
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
                      <div className="text-2xl font-bold mt-1 text-primary">
                        ₦
                        {Math.round(
                          (selectedLaptop.price_cents ?? 0) / 100
                        ).toLocaleString()}
                      </div>
                    </div>

                    {policy && (
                      <>
                        <div>
                          <div className="text-sm text-muted-foreground mb-3">
                            Repayment Duration
                          </div>
                          <Select
                            value={selectedDuration.toString()}
                            onValueChange={(v) =>
                              setSelectedDuration(parseInt(v))
                            }
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

                          <Separator />

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
                          className="w-full"
                          onClick={handleRequestFinancing}
                        >
                          <ShoppingCart className="mr-2 h-4 w-4" />
                          Request Financing
                        </Button>
                      </>
                    )}

                    {!policy && (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          No financing policy configured. Contact your
                          administrator.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Catalog;

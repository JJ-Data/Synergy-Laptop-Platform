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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useCompany } from "@/context/CompanyContext";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Settings, Calculator, Plus, Save, AlertTriangle } from "lucide-react";
import type { Tables } from "@/lib/supabase/types";
import { calculateMonthlyPayment } from "@/lib/finance";

const policySchema = z.object({
  max_amount_cents: z.coerce.number().min(1000000, "Minimum amount is ₦10,000"), // ₦10k minimum
  interest_rate: z.coerce
    .number()
    .min(0, "Interest rate cannot be negative")
    .max(100, "Interest rate cannot exceed 100%"),
  durations_months: z
    .array(z.number())
    .min(1, "At least one duration must be specified"),
});

type PolicyFormData = z.infer<typeof policySchema>;

// Predefined duration options
const DURATION_OPTIONS = [3, 6, 9, 12, 18, 24, 36];

const Policies = () => {
  const { companyId, company } = useCompany();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [selectedDurations, setSelectedDurations] = useState<number[]>([]);

  const policyForm = useForm<PolicyFormData>({
    resolver: zodResolver(policySchema),
    defaultValues: {
      max_amount_cents: 100000000, // ₦1M default
      interest_rate: 5.0,
      durations_months: [6, 12, 18],
    },
  });

  // Fetch current policy
  const { data: policy, isLoading: loadingPolicy } = useQuery({
    queryKey: ["policy", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("policies")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data as Tables<"policies"> | null;
    },
    enabled: !!companyId,
  });

  // Reset form when policy data loads
  useEffect(() => {
    if (policy) {
      policyForm.reset({
        max_amount_cents: policy.max_amount_cents,
        interest_rate: Number(policy.interest_rate),
        durations_months: policy.durations_months || [],
      });
      setSelectedDurations(policy.durations_months || []);
    }
  }, [policy, policyForm]);

  // Create or update policy mutation
  const savePolicyMutation = useMutation({
    mutationFn: async (data: PolicyFormData) => {
      if (!companyId) throw new Error("No company selected");

      const policyData = {
        company_id: companyId,
        max_amount_cents: data.max_amount_cents,
        interest_rate: data.interest_rate,
        durations_months: data.durations_months,
      };

      if (policy) {
        // Update existing policy
        const { error } = await supabase
          .from("policies")
          .update(policyData)
          .eq("id", policy.id);
        if (error) throw error;
      } else {
        // Create new policy
        const { error } = await supabase.from("policies").insert([policyData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policy"] });
      toast.success(
        policy ? "Policy updated successfully" : "Policy created successfully"
      );
      setIsEditing(false);
    },
    onError: (error) => {
      toast.error("Failed to save policy: " + error.message);
    },
  });

  const handleStartEdit = () => {
    if (policy) {
      policyForm.reset({
        max_amount_cents: policy.max_amount_cents,
        interest_rate: Number(policy.interest_rate),
        durations_months: policy.durations_months || [],
      });
      setSelectedDurations(policy.durations_months || []);
    }
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    if (policy) {
      policyForm.reset({
        max_amount_cents: policy.max_amount_cents,
        interest_rate: Number(policy.interest_rate),
        durations_months: policy.durations_months || [],
      });
      setSelectedDurations(policy.durations_months || []);
    }
  };

  const handleDurationToggle = (duration: number) => {
    const newDurations = selectedDurations.includes(duration)
      ? selectedDurations.filter((d) => d !== duration)
      : [...selectedDurations, duration].sort((a, b) => a - b);

    setSelectedDurations(newDurations);
    policyForm.setValue("durations_months", newDurations);
  };

  const onSubmit = (data: PolicyFormData) => {
    savePolicyMutation.mutate({
      ...data,
      durations_months: selectedDurations,
    });
  };

  const watchedValues = policyForm.watch();
  const maxAmount = watchedValues.max_amount_cents / 100; // Convert to regular currency
  const interestRate = watchedValues.interest_rate;

  if (!companyId) {
    return (
      <AppLayout title="Policies">
        <Seo
          title="Policies | Company Admin"
          description="Configure repayment policies and eligibility rules."
        />
        <div className="text-center py-8 text-muted-foreground">
          No company context. Please log in as a company admin.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Financing Policies">
      <Seo
        title="Policies | Company Admin"
        description="Configure repayment policies and eligibility rules."
      />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Financing Policies</h1>
            <p className="text-muted-foreground">
              Configure lending terms and eligibility for {company?.name}
            </p>
          </div>

          {policy && !isEditing && (
            <Button onClick={handleStartEdit} variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Edit Policy
            </Button>
          )}
        </div>

        {loadingPolicy ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                Loading policy...
              </div>
            </CardContent>
          </Card>
        ) : !policy && !isEditing ? (
          // No policy exists - show creation prompt
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                No Policy Configured
              </CardTitle>
              <CardDescription>
                You need to set up a financing policy before employees can
                request laptop financing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={() => setIsEditing(true)} variant="hero">
                <Plus className="mr-2 h-4 w-4" />
                Create Policy
              </Button>
            </CardContent>
          </Card>
        ) : isEditing ? (
          // Editing mode
          <Form {...policyForm}>
            <form
              onSubmit={policyForm.handleSubmit(onSubmit)}
              className="space-y-6"
            >
              <Card>
                <CardHeader>
                  <CardTitle>
                    {policy ? "Edit Policy" : "Create New Policy"}
                  </CardTitle>
                  <CardDescription>
                    Configure your company's laptop financing terms
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <FormField
                      control={policyForm.control}
                      name="max_amount_cents"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Maximum Loan Amount (₦)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="1000000"
                              onChange={(e) => {
                                const value = e.target.value;
                                field.onChange(value ? Number(value) * 100 : 0);
                              }}
                              value={field.value ? field.value / 100 : ""}
                            />
                          </FormControl>
                          <FormDescription>
                            Maximum amount an employee can finance
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={policyForm.control}
                      name="interest_rate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Annual Interest Rate (%)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="5.0"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Annual percentage rate (0% for interest-free)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div>
                    <Label className="text-base font-medium">
                      Allowed Repayment Durations
                    </Label>
                    <p className="text-sm text-muted-foreground mb-4">
                      Select the repayment periods employees can choose from
                    </p>
                    <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                      {DURATION_OPTIONS.map((duration) => (
                        <Button
                          key={duration}
                          type="button"
                          variant={
                            selectedDurations.includes(duration)
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          className="flex flex-col h-auto py-3"
                          onClick={() => handleDurationToggle(duration)}
                        >
                          <span className="font-semibold">{duration}</span>
                          <span className="text-xs opacity-75">
                            month{duration !== 1 ? "s" : ""}
                          </span>
                        </Button>
                      ))}
                    </div>
                    {selectedDurations.length === 0 && (
                      <p className="text-sm text-destructive mt-2">
                        Please select at least one duration
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      disabled={
                        savePolicyMutation.isPending ||
                        selectedDurations.length === 0
                      }
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {savePolicyMutation.isPending
                        ? "Saving..."
                        : policy
                        ? "Update Policy"
                        : "Create Policy"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancelEdit}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </form>
          </Form>
        ) : (
          // View mode - display current policy
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Current Policy</CardTitle>
                <CardDescription>
                  Active financing terms for your company
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Maximum Loan Amount
                  </Label>
                  <div className="text-2xl font-bold">
                    ₦{(policy.max_amount_cents / 100).toLocaleString()}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Interest Rate
                  </Label>
                  <div className="text-2xl font-bold">
                    {policy.interest_rate}%{" "}
                    <span className="text-sm font-normal">per year</span>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Allowed Durations
                  </Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(policy.durations_months || []).map((duration) => (
                      <Badge key={duration} variant="secondary">
                        {duration} month{duration !== 1 ? "s" : ""}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="text-sm text-muted-foreground">
                  Last updated:{" "}
                  {new Date(policy.updated_at).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Payment Calculator
                </CardTitle>
                <CardDescription>
                  Preview monthly payments with current policy
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(policy.durations_months || []).map((duration) => {
                    const monthlyPayment = calculateMonthlyPayment(
                      policy.max_amount_cents / 100,
                      duration,
                      Number(policy.interest_rate)
                    );
                    return (
                      <div
                        key={duration}
                        className="flex justify-between items-center p-3 bg-muted rounded-lg"
                      >
                        <div>
                          <div className="font-medium">{duration} months</div>
                          <div className="text-sm text-muted-foreground">
                            @ max amount
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">
                            ₦{Math.round(monthlyPayment).toLocaleString()}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            per month
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Policy Impact Information */}
        {policy && !isEditing && (
          <Card>
            <CardHeader>
              <CardTitle>Policy Impact</CardTitle>
              <CardDescription>
                How this policy affects employee financing options
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 text-center">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">
                    {(policy.durations_months || []).length}
                  </div>
                  <div className="text-sm text-blue-700">Repayment Options</div>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {policy.interest_rate === 0
                      ? "0%"
                      : `${policy.interest_rate}%`}
                  </div>
                  <div className="text-sm text-green-700">Interest Rate</div>
                </div>
                <div className="p-4 bg-purple-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    ₦{(policy.max_amount_cents / 100).toLocaleString()}
                  </div>
                  <div className="text-sm text-purple-700">Max Financing</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default Policies;

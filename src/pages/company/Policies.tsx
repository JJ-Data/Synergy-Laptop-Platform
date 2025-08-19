import AppLayout from "@/components/layout/AppLayout";
import Seo from "@/components/seo/Seo";
import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";

const Policies = () => {
  const { companyId } = useCompany();
  const queryClient = useQueryClient();
  const [maxAmount, setMaxAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [durations, setDurations] = useState<number[]>([6, 12, 18, 24]);
  const [newDuration, setNewDuration] = useState("");

  const { data: policy, isLoading } = useQuery({
    queryKey: ["policy", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("policies")
        .select("*")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    if (policy) {
      setMaxAmount(((policy.max_amount_cents || 0) / 100).toString());
      setInterestRate((policy.interest_rate || 0).toString());
      setDurations(policy.durations_months || [6, 12, 18, 24]);
    }
  }, [policy]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        company_id: companyId,
        max_amount_cents: Math.round(parseFloat(maxAmount || "0") * 100),
        interest_rate: parseFloat(interestRate || "0"),
        durations_months: durations.sort((a, b) => a - b),
      };

      const { error } = await supabase
        .from("policies")
        .upsert(payload, { onConflict: "company_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policy"] });
      toast.success("Policy saved successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to save policy");
    },
  });

  const addDuration = () => {
    const duration = parseInt(newDuration);
    if (duration > 0 && !durations.includes(duration)) {
      setDurations([...durations, duration].sort((a, b) => a - b));
      setNewDuration("");
    }
  };

  const removeDuration = (duration: number) => {
    if (durations.length > 1) {
      setDurations(durations.filter((d) => d !== duration));
    }
  };

  if (!companyId) {
    return (
      <AppLayout title="Policies">
        <div className="text-center py-8 text-muted-foreground">
          No company context. Please log in as an admin.
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Policies">
      <Seo
        title="Policies | Company Admin"
        description="Configure repayment policies and eligibility rules."
      />

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Repayment Policy Configuration</CardTitle>
            <CardDescription>
              Set the financing terms and limits for your company
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading policy...
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="maxAmount">
                    Maximum Financing Amount (₦)
                  </Label>
                  <Input
                    id="maxAmount"
                    type="number"
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    placeholder="5000000"
                  />
                  <p className="text-sm text-muted-foreground">
                    The maximum amount an employee can finance
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="interestRate">Annual Interest Rate (%)</Label>
                  <Input
                    id="interestRate"
                    type="number"
                    step="0.1"
                    value={interestRate}
                    onChange={(e) => setInterestRate(e.target.value)}
                    placeholder="5.0"
                  />
                  <p className="text-sm text-muted-foreground">
                    The yearly interest rate applied to loans
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Allowed Repayment Durations (Months)</Label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {durations.map((duration) => (
                      <Badge
                        key={duration}
                        variant="secondary"
                        className="text-sm py-1"
                      >
                        {duration} months
                        <button
                          onClick={() => removeDuration(duration)}
                          className="ml-2 hover:text-destructive"
                          disabled={durations.length === 1}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={newDuration}
                      onChange={(e) => setNewDuration(e.target.value)}
                      placeholder="Add duration (e.g., 36)"
                      onKeyPress={(e) => e.key === "Enter" && addDuration()}
                    />
                    <Button
                      variant="outline"
                      onClick={addDuration}
                      disabled={!newDuration || parseInt(newDuration) <= 0}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Employees can choose from these repayment periods
                  </p>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={() => saveMutation.mutate()}
                    disabled={
                      !maxAmount ||
                      !interestRate ||
                      durations.length === 0 ||
                      saveMutation.isPending
                    }
                    className="w-full"
                  >
                    {saveMutation.isPending ? "Saving..." : "Save Policy"}
                  </Button>
                </div>

                {policy && (
                  <div className="mt-6 p-4 bg-muted rounded-lg">
                    <h4 className="font-semibold text-sm mb-2">
                      Current Policy Summary
                    </h4>
                    <div className="space-y-1 text-sm">
                      <p>
                        Max Amount: ₦
                        {(
                          (policy.max_amount_cents || 0) / 100
                        ).toLocaleString()}
                      </p>
                      <p>Interest Rate: {policy.interest_rate}% per year</p>
                      <p>
                        Durations: {(policy.durations_months || []).join(", ")}{" "}
                        months
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Policies;

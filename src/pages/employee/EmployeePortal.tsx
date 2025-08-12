import AppLayout from "@/components/layout/AppLayout";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/context/CompanyContext";

function computeMonthly(price: number, months: number, interestRate: number) {
  const monthlyRate = interestRate / 100 / 12;
  const payment = monthlyRate === 0 ? price / months : (price * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
  return Math.round(payment);
}

const EmployeePortal = () => {
  const { companyId } = useCompany();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [months, setMonths] = useState(12);

  const { data: policy } = useQuery({
    queryKey: ["policy", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("policies")
        .select("interest_rate, durations_months")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: laptops, isLoading } = useQuery({
    queryKey: ["laptops", companyId],
    queryFn: async () => {
      if (!companyId) return [] as any[];
      const { data, error } = await supabase
        .from("laptops")
        .select("id, name, brand, cpu, ram_gb, storage_gb, price_cents, image_url, created_at")
        .eq("company_id", companyId)
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    if (!selectedId && laptops && laptops.length > 0) {
      setSelectedId(laptops[0].id);
    }
  }, [laptops, selectedId]);

  const selected = useMemo(() => (laptops || []).find((l) => l.id === selectedId) || null, [laptops, selectedId]);
  const durations = policy?.durations_months && policy.durations_months.length > 0 ? policy.durations_months : [6, 12, 18];
  const interestRate = policy?.interest_rate ?? 0;
  const monthly = useMemo(() => {
    const price = selected ? Math.round((selected.price_cents ?? 0) / 100) : 0;
    return computeMonthly(price, months, interestRate);
  }, [selected, months, interestRate]);

  return (
    <AppLayout title="Employee Portal">
      <Seo title="Employee | Portal" description="Choose a laptop and repayment plan, track your status." canonical="/employee" />

      <section className="grid lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Available Laptops</CardTitle>
            <CardDescription>Company-specific catalog</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            {!companyId && <div className="text-sm text-muted-foreground">No company context.</div>}
            {companyId && isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
            {companyId && !isLoading && (laptops?.length ?? 0) === 0 && (
              <div className="text-sm text-muted-foreground">No laptops available yet.</div>
            )}
            {companyId && (laptops || []).map((l) => (
              <button
                key={l.id}
                onClick={() => setSelectedId(l.id)}
                className={`text-left rounded-md border p-3 transition-all hover:shadow ${
                  selected?.id === l.id ? "ring-2 ring-primary" : ""
                }`}
              >
                <div className="h-28 overflow-hidden rounded">
                  <img src={l.image_url || "/placeholder.svg"} alt={`${l.name} laptop image`} className="h-full w-full object-cover" loading="lazy" />
                </div>
                <div className="mt-3 font-medium">{l.brand ? `${l.brand} ${l.name}` : l.name}</div>
                <div className="text-sm text-muted-foreground">
                  {[l.cpu, l.ram_gb ? `${l.ram_gb}GB` : null, l.storage_gb ? `${l.storage_gb}GB` : null].filter(Boolean).join(" • ")}
                </div>
                <div className="mt-1 text-sm font-semibold">₦{Math.round((l.price_cents ?? 0) / 100).toLocaleString()}</div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Repayment Plan</CardTitle>
            <CardDescription>Preview your monthly payment</CardDescription>
          </CardHeader>
          <CardContent>
            {!selected ? (
              <div className="text-sm text-muted-foreground">Select a laptop to preview your plan.</div>
            ) : (
              <>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-muted-foreground">Selected</div>
                    <div className="font-semibold">{selected.brand ? `${selected.brand} ${selected.name}` : selected.name}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Price</div>
                    <div className="font-semibold">₦{Math.round((selected.price_cents ?? 0) / 100).toLocaleString()}</div>
                  </div>
                  <div className="sm:col-span-2">
                    <div className="mb-2 text-sm text-muted-foreground">Duration</div>
                    <Select defaultValue={months.toString()} onValueChange={(v) => setMonths(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {durations.map((m: number) => (
                          <SelectItem key={m} value={m.toString()}>
                            {m} months
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="mt-6 rounded-md border p-4 bg-secondary/30">
                  <div className="text-sm text-muted-foreground">Estimated monthly payment</div>
                  <div className="text-3xl font-semibold mt-1">₦{monthly.toLocaleString()}</div>
                </div>
                <div className="mt-4 flex gap-3">
                  <Button variant="hero">Request Financing</Button>
                  <Button variant="outline">View Terms</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold mb-4">Current Financing</h2>
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <CardDescription>Track your balance and history</CardDescription>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Outstanding</div>
              <div className="font-semibold">—</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Next Deduction</div>
              <div className="font-semibold">—</div>
            </div>
            <div className="flex items-end justify-end">
              <Button variant="subtle">Download Schedule</Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </AppLayout>
  );
};

export default EmployeePortal;

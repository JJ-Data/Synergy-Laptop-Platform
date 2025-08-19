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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/context/CompanyContext";
import { BarChart, ResponsiveContainer } from "recharts";

const AdminDashboard = () => {
  const { companyId } = useCompany();

  const { data: policy, isLoading: loadingPolicy } = useQuery({
    queryKey: ["policy", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("policies")
        .select("max_amount_cents, interest_rate, durations_months")
        .eq("company_id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: laptops, isLoading: loadingLaptops } = useQuery({
    queryKey: ["laptops", companyId],
    queryFn: async () => {
      if (!companyId) return [] as any[];
      const { data, error } = await supabase
        .from("laptops")
        .select(
          "id, name, brand, cpu, ram_gb, storage_gb, price_cents, image_url, created_at"
        )
        .eq("company_id", companyId)
        .eq("active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });
  const { data: monthlyRequests } = useQuery({
    queryKey: ["monthly-requests", companyId],
    queryFn: async () => {
      if (!companyId) return [];

      const { data } = await supabase
        .from("requests")
        .select("created_at, status")
        .eq("company_id", companyId)
        .gte(
          "created_at",
          new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
        );

      // Group by month
      const grouped = data?.reduce((acc: any, req) => {
        const month = new Date(req.created_at).toLocaleDateString("en", {
          month: "short",
        });
        if (!acc[month])
          acc[month] = { month, pending: 0, approved: 0, rejected: 0 };
        acc[month][req.status]++;
        return acc;
      }, {});

      return Object.values(grouped || {});
    },
    enabled: !!companyId,
  });

  return (
    <AppLayout title="Company Admin">
      <Seo
        title="Company Admin | Dashboard"
        description="Manage catalog, policies, and financing requests."
        canonical="/admin"
      />

      <section className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Repayment Policy</CardTitle>
            <CardDescription>Control max budgets and terms</CardDescription>
          </CardHeader>
          <CardContent>
            {!companyId && (
              <div className="text-sm text-muted-foreground">
                No company context. Log in as an Admin to view policies.
              </div>
            )}
            {companyId && loadingPolicy && (
              <div className="text-sm text-muted-foreground">
                Loading policy…
              </div>
            )}
            {companyId && !loadingPolicy && !policy && (
              <div className="text-sm text-muted-foreground">
                No policy configured yet. Use the Policies page to create one.
              </div>
            )}
            {companyId && policy && (
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label>Max Amount (₦)</Label>
                  <Input
                    value={(policy.max_amount_cents ?? 0) / 100}
                    readOnly
                  />
                </div>
                <div>
                  <Label>Interest Rate (%)</Label>
                  <Input value={policy.interest_rate ?? 0} readOnly />
                </div>
                <div className="sm:col-span-2">
                  <Label>Allowed Durations</Label>
                  <Select disabled>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={policy.durations_months?.join(", ") || "—"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(policy.durations_months || []).map((m: number) => (
                        <SelectItem key={m} value={String(m)}>
                          {m} months
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Onboard Employees</CardTitle>
            <CardDescription>Invite or upload CSV</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Button variant="outline">Invite via Email</Button>
            <Button variant="subtle">Upload CSV</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request Trends</CardTitle>
            <CardDescription>Last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthlyRequests}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="approved" fill="#10b981" />
                <Bar dataKey="pending" fill="#f59e0b" />
                <Bar dataKey="rejected" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Laptop Catalog</h2>
          <Button variant="hero">Add Laptop</Button>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {!companyId && (
            <div className="text-sm text-muted-foreground">
              No company context.
            </div>
          )}
          {companyId && loadingLaptops && (
            <div className="text-sm text-muted-foreground">
              Loading laptops…
            </div>
          )}
          {companyId && !loadingLaptops && (laptops?.length ?? 0) === 0 && (
            <div className="text-sm text-muted-foreground">
              No laptops in catalog yet.
            </div>
          )}
          {companyId &&
            (laptops || []).map((l) => (
              <Card key={l.id} className="group overflow-hidden">
                <div className="h-44 overflow-hidden">
                  <img
                    src={l.image_url || "/placeholder.svg"}
                    alt={`${l.name} laptop image`}
                    className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform"
                    loading="lazy"
                  />
                </div>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {l.brand ? `${l.brand} ${l.name}` : l.name}
                  </CardTitle>
                  <CardDescription>
                    {[
                      l.cpu,
                      l.ram_gb ? `${l.ram_gb}GB` : null,
                      l.storage_gb ? `${l.storage_gb}GB` : null,
                    ]
                      .filter(Boolean)
                      .join(" • ")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="font-semibold">
                    ₦{Math.round((l.price_cents ?? 0) / 100).toLocaleString()}
                  </div>
                  <Button variant="outline">Edit</Button>
                </CardContent>
              </Card>
            ))}
        </div>
      </section>
    </AppLayout>
  );
};

export default AdminDashboard;

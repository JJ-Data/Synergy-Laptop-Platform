import AppLayout from "@/components/layout/AppLayout";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SuperDashboard = () => {
  const { data: stats } = useQuery({
    queryKey: ["super-stats"],
    queryFn: async () => {
      const [companiesHead, loansHead, repaymentsHead, paidHead] = await Promise.all([
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("loans").select("id", { count: "exact", head: true }),
        supabase.from("repayments").select("id", { count: "exact", head: true }),
        supabase.from("repayments").select("id", { count: "exact", head: true }).eq("status", "paid"),
      ]);
      const companies = companiesHead.count ?? 0;
      const loans = loansHead.count ?? 0;
      const totalRepay = repaymentsHead.count ?? 0;
      const paidRepay = paidHead.count ?? 0;
      const rate = totalRepay > 0 ? Math.round((paidRepay / totalRepay) * 100) : 0;
      return { companies, loans, rate };
    },
  });

  const { data: companies } = useQuery({
    queryKey: ["companies", "recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, domain, created_at")
        .order("created_at", { ascending: false })
        .limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <AppLayout title="Super Admin Overview">
      <Seo title="Super Admin | Overview" description="Global view of tenants, users, and repayments." canonical="/super" />
      <section className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Tenants</CardTitle>
            <CardDescription>Total companies onboarded</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats?.companies ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active Loans</CardTitle>
            <CardDescription>Across all companies</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats?.loans ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Repayment Rate</CardTitle>
            <CardDescription>Paid on time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{stats ? `${stats.rate}%` : "—"}</div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Companies</h2>
          <Button variant="hero" asChild>
            <Link to="/super/companies">New Company</Link>
          </Button>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {(companies || []).map((c) => (
            <Card key={c.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle>{c.name}</CardTitle>
                <CardDescription>{c.domain || "No domain"}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <Button variant="outline" asChild>
                  <Link to="/super/companies">Manage</Link>
                </Button>
                <Button variant="subtle" asChild>
                  <Link to="/super/companies">Assign Admin</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
          {companies && companies.length === 0 && (
            <div className="text-sm text-muted-foreground">No companies yet.</div>
          )}
        </div>
      </section>
    </AppLayout>
  );
};

export default SuperDashboard;

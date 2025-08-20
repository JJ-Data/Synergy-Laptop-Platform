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
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

// Loading component
const LoadingSpinner = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12",
  };

  return (
    <div className="flex justify-center items-center p-4">
      <Loader2 className={`animate-spin text-primary ${sizeClasses[size]}`} />
    </div>
  );
};

const SuperDashboard = () => {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["super-stats"],
    queryFn: async () => {
      const [companiesHead, loansHead, repaymentsHead, paidHead] =
        await Promise.all([
          supabase
            .from("companies")
            .select("id", { count: "exact", head: true }),
          supabase.from("loans").select("id", { count: "exact", head: true }),
          supabase
            .from("repayments")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("repayments")
            .select("id", { count: "exact", head: true })
            .eq("status", "paid"),
        ]);
      const companies = companiesHead.count ?? 0;
      const loans = loansHead.count ?? 0;
      const totalRepay = repaymentsHead.count ?? 0;
      const paidRepay = paidHead.count ?? 0;
      const rate =
        totalRepay > 0 ? Math.round((paidRepay / totalRepay) * 100) : 0;
      return { companies, loans, rate };
    },
  });

  const { data: companies, isLoading: companiesLoading } = useQuery({
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
      <Seo
        title="Super Admin | Overview"
        description="Global view of tenants, users, and repayments."
        canonical="/super"
      />

      <section className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Company</CardTitle>
            <CardDescription>Total companies onboarded</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <div className="text-3xl font-semibold">
                {stats?.companies ?? 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Active Loans</CardTitle>
            <CardDescription>Across all companies</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <div className="text-3xl font-semibold">{stats?.loans ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Repayment Rate</CardTitle>
            <CardDescription>Paid on time</CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <LoadingSpinner size="sm" />
            ) : (
              <div className="text-3xl font-semibold">
                {stats ? `${stats.rate}%` : "0%"}
              </div>
            )}
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

        {companiesLoading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : companies && companies.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {companies.map((c) => (
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
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground mb-4">No companies yet</p>
              <Button variant="hero" asChild>
                <Link to="/super/companies">Create First Company</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </section>
    </AppLayout>
  );
};

export default SuperDashboard;

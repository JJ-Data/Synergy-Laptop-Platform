import AppLayout from "@/components/layout/AppLayout";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

const SuperDashboard = () => {
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
            <div className="text-3xl font-semibold">12</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active Loans</CardTitle>
            <CardDescription>Across all companies</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">318</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Repayment Rate</CardTitle>
            <CardDescription>Paid on time</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">96%</div>
          </CardContent>
        </Card>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Companies</h2>
          <Button variant="hero">New Company</Button>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {["Acme Corp", "Nova Bank", "Atlas Logistics", "Prime Foods", "Bright Tech"].map((c) => (
            <Card key={c} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle>{c}</CardTitle>
                <CardDescription>Monthly volume ₦{(Math.random() * 5 + 1).toFixed(1)}m</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <Button variant="outline" asChild>
                  <Link to="#">Manage</Link>
                </Button>
                <Button variant="subtle">Assign Admin</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </AppLayout>
  );
};

export default SuperDashboard;

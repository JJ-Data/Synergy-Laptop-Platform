import { Link } from "react-router-dom";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-finance.jpg";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Laptop Financing Platform"
        description="Manage company devices, approvals, and repayments across tenants with role-based access."
        canonical="/"
      />

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img
            src={heroImage}
            alt="Abstract fintech gradient background for device financing dashboard"
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-br from-background/10 to-background/70" />
        </div>

        <div className="container py-24 md:py-32">
          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-5xl font-semibold leading-tight">
              Enterprise laptop financing, simplified for every company
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              A secure, multi‑tenant platform for administrators and employees
              to manage devices, approvals, and repayments with complete
              transparency.
            </p>
            <div className="mt-8 flex flex-wrap gap-4 items-center">
              <Button
                asChild
                variant="hero"
                size="lg"
                className="relative overflow-hidden"
              >
                <Link to="/login">
                  <span className="pointer-events-none absolute inset-y-0 left-[-100%] w-1/3 bg-foreground/10 blur-md animate-shine" />
                  Get Started
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#features">Explore Features</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="container py-16 md:py-20">
        <div className="grid md:grid-cols-3 gap-8">
          <article>
            <h3 className="text-xl font-semibold">Platform Administrator</h3>
            <p className="text-muted-foreground mt-2">
              Onboard companies, assign administrators, and view performance
              metrics across all tenants.
            </p>
          </article>
          <article>
            <h3 className="text-xl font-semibold">Company Administrator</h3>
            <p className="text-muted-foreground mt-2">
              Manage laptop catalogs, financing policies, employee requests, and
              repayment schedules.
            </p>
          </article>
          <article>
            <h3 className="text-xl font-semibold">Employee Access</h3>
            <p className="text-muted-foreground mt-2">
              Browse approved laptops, submit financing requests, and track
              repayment progress.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
};

export default Index;

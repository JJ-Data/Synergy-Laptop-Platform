import { Link } from "react-router-dom";
import Seo from "@/components/seo/Seo";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-finance.jpg";
import * as React from "react";

const Index = () => {
  // (optional) small, tasteful counter animation for the KPI card
  const [companies, setCompanies] = React.useState(0);
  React.useEffect(() => {
    const target = 12;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 800); // ~0.8s
      setCompanies(Math.round(target * p));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Seo
        title="Laptop Financing Platform"
        description="Manage company devices, approvals, and repayments across tenants with role-based access."
        canonical="/"
      />

      {/* HERO */}
      <section className="relative overflow-hidden">
        {/* Soft backdrop gradient */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-muted/40" />
          <div className="absolute -top-40 -right-40 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-40 -left-40 h-[28rem] w-[28rem] rounded-full bg-foreground/5 blur-3xl" />
        </div>

        <div className="container py-20 md:py-28">
          <div className="grid items-center gap-10 md:grid-cols-2">
            {/* LEFT: copy */}
            <div className="max-w-xl">
              <h1 className="text-4xl md:text-5xl font-semibold leading-tight tracking-tight">
                Synergy laptop financing, simplified for every company
              </h1>

              <p className="mt-4 text-lg text-muted-foreground">
                A secure platform for administrators and employees to manage
                devices, approvals, and repayments with complete transparency.
              </p>

              {/* CTA row */}
              <div className="mt-8 flex flex-wrap items-center gap-4">
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
                  <Link to="/register">Create Company</Link>
                </Button>
              </div>

              {/* Inline highlights (replaces the old bottom section) */}
              <div className="mt-8 flex flex-wrap gap-3">
                <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Multi-tenant
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                  RLS-secured
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  Automated repayments
                </span>
              </div>
            </div>

            {/* RIGHT: visual panel */}
            <div className="relative">
              {/* Spinning halo */}
              <div className="absolute inset-0 -z-10 grid place-items-center">
                <div className="h-64 w-64 md:h-80 md:w-80 rounded-full bg-gradient-to-tr from-primary/20 via-primary/0 to-primary/20 blur-xl" />
                <div className="absolute h-64 w-64 md:h-80 md:w-80 rounded-full border border-primary/20 animate-spin [animation-duration:14s]" />
              </div>

              {/* Image card with subtle tilt */}
              <div className="group relative mx-auto w-[90%] max-w-lg rounded-2xl border bg-card/80 backdrop-blur-md shadow-sm ring-1 ring-border transition-transform duration-300 hover:-translate-y-1">
                <img
                  src={heroImage}
                  alt="Laptop financing dashboard preview"
                  className="aspect-[16/10] w-full rounded-2xl object-cover"
                  loading="lazy"
                />

                {/* Floating KPI card */}
                <div className="absolute -bottom-6 left-6">
                  <div className="rounded-xl border bg-background/90 p-4 shadow-sm backdrop-blur-md">
                    <p className="text-xs text-muted-foreground">
                      Active Companies
                    </p>
                    <p className="text-2xl font-semibold">{companies}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      98.4% on-time repayments
                    </div>
                  </div>
                </div>

                {/* Floating approval badge */}
                <div className="absolute -top-4 right-6">
                  <div className="flex items-center gap-2 rounded-full bg-emerald-600/10 px-3 py-1.5 ring-1 ring-emerald-600/20">
                    <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-ping [animation-duration:1.5s]" />
                    <span className="text-xs font-medium text-emerald-700">
                      Approvals live
                    </span>
                  </div>
                </div>
              </div>

              {/* subtle shadow under the card */}
              <div className="mx-auto mt-10 h-6 w-3/4 rounded-full bg-foreground/5 blur-xl" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;

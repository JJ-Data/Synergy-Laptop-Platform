import { ReactNode } from "react";
import { NavLink, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useCompany } from "@/context/CompanyContext";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  title?: string;
  children: ReactNode;
}

export const AppLayout = ({ title, children }: AppLayoutProps) => {
  const { user, logout } = useAuth();
  const { company } = useCompany();

  const nav = (() => {
    if (!user) return [] as { to: string; label: string }[];
    if (user.role === "super_admin")
      return [
        { to: "/super", label: "Overview" },
        { to: "/super/companies", label: "Companies" },
        { to: "/super/users", label: "Users" },
      ];
    if (user.role === "admin")
      return [
        { to: "/admin", label: "Dashboard" },
        { to: "/admin/catalog", label: "Catalog" },
        { to: "/admin/policies", label: "Policies" },
        { to: "/admin/requests", label: "Requests" },
        { to: "/admin/users", label: "Users" },
      ];
    return [
      { to: "/employee", label: "My Portal" },
      { to: "/employee/catalog", label: "Catalog" },
      { to: "/employee/repayments", label: "Repayments" },
    ];
  })();

  // Dynamic brand name based on user context
  const brandName = (() => {
    if (user?.role === "super_admin") {
      return "Platform Admin"; // Super admin sees platform name
    }
    return company?.name || "Laptop Financing"; // Others see company name or fallback
  })();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container flex items-center justify-between py-4">
          <Link
            to={
              user
                ? user.role === "super_admin"
                  ? "/super"
                  : user.role === "admin"
                  ? "/admin"
                  : "/employee"
                : "/"
            }
            className="font-semibold text-lg"
          >
            {brandName}
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `text-sm transition-colors ${
                    isActive
                      ? "text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {user && (
              <div className="text-right hidden sm:block">
                <div className="text-sm font-medium">{user.email}</div>
                {company && user.role !== "super_admin" && (
                  <div className="text-xs text-muted-foreground">
                    {company.name}
                  </div>
                )}
              </div>
            )}
            {user ? (
              <Button variant="outline" size="sm" onClick={logout}>
                Logout
              </Button>
            ) : (
              <Button asChild variant="default" size="sm">
                <Link to="/login">Login</Link>
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="container py-8">
        {title && <h1 className="text-2xl font-semibold mb-6">{title}</h1>}
        {children}
      </main>
      <footer className="border-t mt-12">
        <div className="container py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} {brandName} — Laptop financing platform.
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;

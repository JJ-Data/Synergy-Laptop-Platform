import { ReactNode } from "react";
import { NavLink, Link } from "react-router-dom";
import { Menu } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

interface AppLayoutProps {
  title?: string;
  children: ReactNode;
}

export const AppLayout = ({ title, children }: AppLayoutProps) => {
  const { user, logout } = useAuth();

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
      ];
    return [
      { to: "/employee", label: "My Portal" },
      { to: "/employee/catalog", label: "Catalog" },
      { to: "/employee/repayments", label: "Repayments" },
    ];
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
            className="font-semibold"
          >
            Laptop Platform
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `text-sm ${
                    isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-3">
              {user && (
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {user.email}
                </span>
              )}
              {user ? (
                <Button variant="outline" size="sm" onClick={logout}>
                  Logout
                </Button>
              ) : (
                <Button asChild variant="hero" size="sm">
                  <Link to="/login">Login</Link>
                </Button>
              )}
            </div>
            <div className="md:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-5 w-5" />
                    <span className="sr-only">Toggle menu</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-6">
                  <nav className="flex flex-col gap-4 mt-4">
                    {nav.map((n) => (
                      <SheetClose asChild key={n.to}>
                        <NavLink to={n.to} className="text-lg">
                          {n.label}
                        </NavLink>
                      </SheetClose>
                    ))}
                    {user ? (
                      <SheetClose asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={logout}
                          className="mt-4"
                        >
                          Logout
                        </Button>
                      </SheetClose>
                    ) : (
                      <SheetClose asChild>
                        <Button
                          asChild
                          variant="hero"
                          size="sm"
                          className="mt-4"
                        >
                          <Link to="/login">Login</Link>
                        </Button>
                      </SheetClose>
                    )}
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>
      <main className="container py-8">
        {title && <h1 className="text-2xl font-semibold mb-6">{title}</h1>}
        {children}
      </main>
      <footer className="border-t mt-12">
        <div className="container py-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} Synergy — Laptop financing.
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;

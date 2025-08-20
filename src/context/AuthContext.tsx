import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/lib/supabase/client";

export type Role = "super_admin" | "admin" | "employee";

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: Role;
  companyId?: string | null; // super_admin may have null company
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (email: string, password: string, mode: "signin" | "signup") => Promise<{ error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [initialized, setInitialized] = useState(false);

  // Helper: compute highest role with precedence
  const computeAuthUser = async (uid: string, email: string): Promise<AuthUser | null> => {
    // Fetch roles
    const { data: roles, error: rolesErr } = await supabase
      .from("user_roles")
      .select("role, company_id")
      .eq("user_id", uid);

    if (rolesErr) {
      console.error("Failed fetching roles", rolesErr);
      return { id: uid, email, role: "employee" } as AuthUser; // fallback minimal
    }

    let role: Role = "employee";
    let companyId: string | null | undefined = null;

    const hasSuper = (roles || []).some((r) => r.role === "super_admin");
    const adminRow = (roles || []).find((r) => r.role === "admin");
    const employeeRow = (roles || []).find((r) => r.role === "employee");

    if (hasSuper) {
      role = "super_admin";
      companyId = null;
    } else if (adminRow) {
      role = "admin";
      companyId = adminRow.company_id ?? null;
    } else if (employeeRow) {
      role = "employee";
      companyId = employeeRow.company_id ?? null;
    }


    // Fetch profile (optional)
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, company_id")
      .eq("id", uid)
      .maybeSingle();

    return {
      id: uid,
      email,
      name: profile?.display_name ?? email.split("@")[0],
      role,
      companyId: role === "super_admin" ? null : (companyId ?? profile?.company_id ?? null),
    };
  };

  useEffect(() => {
    // Listen FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const s = session;
      if (!s?.user) {
        setUser(null);
        setInitialized(true);
        return;
      }
      // Defer Supabase calls outside the callback to avoid deadlocks
      setTimeout(async () => {
        // Attempt one-time bootstrap of super_admin (safe if already set)
        try {
          await supabase.rpc("bootstrap_super_admin");
        } catch (e) {
          // noop
        }
        const next = await computeAuthUser(s.user.id, s.user.email ?? "");
        setUser(next);
        setInitialized(true);
      }, 0);
    });

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const s = session;
      if (s?.user) {
        const next = await computeAuthUser(s.user.id, s.user.email ?? "");
        setUser(next);
      }
      setInitialized(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login: AuthContextValue["login"] = async (email, password, mode) => {
    if (mode === "signup") {
      const redirectUrl = `${window.location.origin}/`;
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectUrl },
      });
      return { error: error?.message };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message };
  };

  const logout: AuthContextValue["logout"] = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const value = useMemo(() => ({ user, login, logout }), [user]);
  return <AuthContext.Provider value={value}>{initialized ? children : null}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const ProtectedRoute: React.FC<{ children: React.ReactElement; roles?: Role[] }> = ({
  children,
  roles,
}) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
};

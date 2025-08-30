// src/context/AuthContext.tsx - Simplified version to prevent multiple login attempts
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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
  login: (
    email: string,
    password: string,
    mode: "signin" | "signup"
  ) => Promise<{ error?: string }>;
  logout: () => Promise<void>;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Simplified helper to compute auth user
  const computeAuthUser = async (
    uid: string,
    email: string
  ): Promise<AuthUser | null> => {
    try {
      console.log("Computing auth user for:", { uid, email });

      // Bootstrap super admin if needed (safe if already exists)
      try {
        await supabase.rpc("bootstrap_super_admin");
      } catch (e) {
        // Ignore bootstrap errors
      }

      // Fetch roles with a single query
      const { data: roles, error: rolesErr } = await supabase
        .from("user_roles")
        .select("role, company_id")
        .eq("user_id", uid);

      if (rolesErr) {
        console.error("Failed fetching roles:", rolesErr);
        // Return a basic user instead of throwing
        return {
          id: uid,
          email,
          name: email.split("@")[0],
          role: "employee",
          companyId: null,
        };
      }

      console.log("Found roles:", roles);

      // Determine highest priority role
      let role: Role = "employee";
      let companyId: string | null = null;

      const hasSuper = (roles || []).some((r) => r.role === "super_admin");
      const adminRow = (roles || []).find((r) => r.role === "admin");
      const employeeRow = (roles || []).find((r) => r.role === "employee");

      if (hasSuper) {
        role = "super_admin";
        companyId = null;
      } else if (adminRow) {
        role = "admin";
        companyId = adminRow.company_id;
      } else if (employeeRow) {
        role = "employee";
        companyId = employeeRow.company_id;
      }

      console.log("Computed role:", { role, companyId });

      // Try to fetch profile (optional)
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", uid)
        .maybeSingle();

      const authUser: AuthUser = {
        id: uid,
        email,
        name: profile?.display_name || email.split("@")[0],
        role,
        companyId,
      };

      console.log("Final auth user:", authUser);
      return authUser;
    } catch (error) {
      console.error("Error computing auth user:", error);
      return null;
    }
  };

  // Initialize auth state
  useEffect(() => {
    if (isInitialized) return;

    console.log("Initializing auth state...");

    let isProcessing = false;

    const initializeAuth = async () => {
      if (isProcessing) return;
      isProcessing = true;

      try {
        // Get current session
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        console.log("Initial session check:", {
          hasSession: !!session,
          hasUser: !!session?.user,
          error: error?.message,
        });

        if (error) {
          console.error("Session error:", error);
          setUser(null);
        } else if (session?.user) {
          const authUser = await computeAuthUser(
            session.user.id,
            session.user.email || ""
          );
          setUser(authUser);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        setUser(null);
      } finally {
        setLoading(false);
        setIsInitialized(true);
        isProcessing = false;
      }
    };

    // Set up auth state change listener
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state change:", { event, hasSession: !!session });

      if (event === "SIGNED_OUT" || !session?.user) {
        setUser(null);
        setLoading(false);
        return;
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (!isProcessing) {
          isProcessing = true;
          try {
            const authUser = await computeAuthUser(
              session.user.id,
              session.user.email || ""
            );
            setUser(authUser);
          } catch (error) {
            console.error("Auth state change error:", error);
            setUser(null);
          } finally {
            setLoading(false);
            isProcessing = false;
          }
        }
      }
    });

    // Initialize immediately
    initializeAuth();

    return () => {
      subscription.unsubscribe();
    };
  }, [isInitialized]);

  const login: AuthContextValue["login"] = async (email, password, mode) => {
    try {
      setLoading(true);

      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) {
          console.error("Sign up error:", error);
          return { error: error.message };
        }

        return {};
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error("Sign in error:", error);
          return { error: error.message };
        }

        return {};
      }
    } catch (error: any) {
      console.error("Login error:", error);
      return { error: error.message || "Login failed" };
    } finally {
      setLoading(false);
    }
  };

  const logout: AuthContextValue["logout"] = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const value = useMemo(
    () => ({
      user,
      login,
      logout,
      loading,
    }),
    [user, loading]
  );

  // Don't render children until initialized
  if (!isInitialized || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const ProtectedRoute: React.FC<{
  children: React.ReactElement;
  roles?: Role[];
}> = ({ children, roles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Show loading spinner while auth is loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Authenticating...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Check role permissions
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

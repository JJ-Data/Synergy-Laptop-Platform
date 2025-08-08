import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";

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
  login: (payload: { email: string; role: Role; companyId?: string | null; name?: string }) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "app_session";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {
      // noop
    }
  }, []);

  const login: AuthContextValue["login"] = ({ email, role, companyId = null, name }) => {
    const newUser: AuthUser = {
      id: crypto.randomUUID(),
      email,
      name: name ?? email.split("@")[0],
      role,
      companyId,
    };
    setUser(newUser);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const value = useMemo(() => ({ user, login, logout }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
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

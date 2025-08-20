import React, { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { Tables } from "@/lib/supabase/types";

interface CompanyContextValue {
  companyId: string | null;
  company: Tables<'companies'> | null;
  loading: boolean;
}

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

export const CompanyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const companyId = user?.companyId ?? null;

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", companyId],
    queryFn: async () => {
      if (!companyId) return null;
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, domain, created_at")
        .eq("id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data as Tables<'companies'> | null;
    },
    enabled: !!companyId,
  });

  const value = useMemo<CompanyContextValue>(() => ({ companyId, company: company ?? null, loading: isLoading }), [companyId, company, isLoading]);

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
};

export const useCompany = () => {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error("useCompany must be used within CompanyProvider");
  return ctx;
};

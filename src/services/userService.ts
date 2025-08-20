// src/services/userService.ts
import { supabase } from "@/lib/supabase/client";

export interface CompanyUser {
  id: string;
  email: string;
  displayName?: string;
  role: string;
  joinedAt: string;
  lastActive?: string;
  avatarUrl?: string;
}

export class UserService {
  static async getCompanyUsers(companyId: string): Promise<CompanyUser[]> {
    try {
      // Get user roles for the company
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select(
          `
          user_id,
          role,
          created_at
        `
        )
        .eq("company_id", companyId);

      if (rolesError) throw rolesError;

      if (!userRoles || userRoles.length === 0) {
        return [];
      }

      // Get profiles for these users
      const userIds = userRoles.map((r) => r.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, updated_at")
        .in("id", userIds);

      if (profilesError) throw profilesError;

      // Combine the data
      const users: CompanyUser[] = userRoles.map((roleData) => {
        const profile = profiles?.find((p) => p.id === roleData.user_id);

        return {
          id: roleData.user_id,
          email: "", // We'll fetch this separately if needed
          displayName: profile?.display_name,
          role: roleData.role,
          joinedAt: roleData.created_at,
          lastActive: profile?.updated_at,
          avatarUrl: profile?.avatar_url,
        };
      });

      // Try to get emails from auth (might fail due to permissions)
      try {
        const {
          data: { users: authUsers },
        } = await supabase.auth.admin.listUsers();
        users.forEach((user) => {
          const authUser = authUsers?.find((u) => u.id === user.id);
          if (authUser) {
            user.email = authUser.email || "";
          }
        });
      } catch {
        // If we can't get emails from auth, try to get them from profiles
        // or leave them empty
        console.warn("Could not fetch user emails from auth");
      }

      return users;
    } catch (error) {
      console.error("Error fetching company users:", error);
      throw error;
    }
  }

  static async updateUserRole(
    userId: string,
    companyId: string,
    newRole: string
  ) {
    const { error } = await supabase
      .from("user_roles")
      .update({ role: newRole })
      .eq("user_id", userId)
      .eq("company_id", companyId);

    if (error) throw error;
  }

  static async removeUserFromCompany(userId: string, companyId: string) {
    const { error } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("company_id", companyId);

    if (error) throw error;
  }

  static async getUserActivity(userId: string, companyId: string) {
    // Get user's recent activity
    const [loans, requests, repayments] = await Promise.all([
      supabase
        .from("loans")
        .select("id, created_at, status")
        .eq("employee_id", userId)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(5),

      supabase
        .from("requests")
        .select("id, created_at, status")
        .eq("employee_id", userId)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(5),

      supabase
        .from("repayments")
        .select("id, paid_at, status")
        .eq("employee_id", userId)
        .eq("company_id", companyId)
        .eq("status", "paid")
        .order("paid_at", { ascending: false })
        .limit(5),
    ]);

    return {
      loans: loans.data || [],
      requests: requests.data || [],
      repayments: repayments.data || [],
    };
  }
}

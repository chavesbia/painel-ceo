import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "viewer" | "operator" | "admin";

export type CurrentUser = {
  id: string;
  username: string;
  full_name: string;
  must_change_password: boolean;
  roles: AppRole[];
  isAdmin: boolean;
  isOperator: boolean;
  isViewer: boolean;
};

export function useCurrentUser() {
  return useQuery<CurrentUser | null>({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) return null;
      const [{ data: profile }, { data: rolesData }] = await Promise.all([
        supabase.from("profiles").select("username, full_name, must_change_password").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      const roles = (rolesData?.map((r) => r.role) ?? []) as AppRole[];
      return {
        id: user.id,
        username: profile?.username ?? user.email?.split("@")[0] ?? "",
        full_name: profile?.full_name ?? "",
        must_change_password: profile?.must_change_password ?? false,
        roles,
        isAdmin: roles.includes("admin"),
        isOperator: roles.includes("operator") || roles.includes("admin"),
        isViewer: roles.includes("viewer") || roles.includes("operator") || roles.includes("admin"),
      };
    },
    staleTime: 60_000,
  });
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join("") || "?";
}
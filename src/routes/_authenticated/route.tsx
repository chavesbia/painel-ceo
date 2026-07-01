import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.pathname } });
    }
    const { data: prof } = await supabase
      .from("profiles")
      .select("must_change_password")
      .eq("id", data.user.id)
      .maybeSingle();
    if (prof?.must_change_password && location.pathname !== "/trocar-senha") {
      throw redirect({ to: "/trocar-senha" });
    }
    return { userId: data.user.id };
  },
  component: () => <Outlet />,
});
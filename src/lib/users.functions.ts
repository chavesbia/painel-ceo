import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const RoleEnum = z.enum(["viewer", "operator", "admin"]);
const emailFor = (username: string) => `${username.trim().toLowerCase()}@prevermed.local`;

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Forbidden: admin role required");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profiles }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, username, full_name, must_change_password, created_at").order("created_at"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    return (profiles || []).map((p) => ({
      ...p,
      roles: (roles || []).filter((r) => r.user_id === p.id).map((r) => r.role as "viewer" | "operator" | "admin"),
    }));
  });

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      username: z.string().min(3).regex(/^[a-z0-9.]+$/i, "Use apenas letras, números e ponto"),
      full_name: z.string().min(1),
      role: RoleEnum,
      password: z.string().min(6).default("prevermed"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: emailFor(data.username),
      password: data.password,
      email_confirm: true,
      user_metadata: {
        username: data.username.toLowerCase(),
        full_name: data.full_name,
        must_change_password: true,
      },
    });
    if (error || !created.user) throw new Error(error?.message || "Falha ao criar usuário");
    await supabaseAdmin.from("profiles").upsert({
      id: created.user.id,
      username: data.username.toLowerCase(),
      full_name: data.full_name,
      must_change_password: true,
    });
    const { error: roleErr } = await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: data.role });
    if (roleErr) throw new Error(roleErr.message);
    return { id: created.user.id };
  });

export const resetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ userId: z.string().uuid(), password: z.string().min(6).default("prevermed") }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, { password: data.password });
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("profiles").update({ must_change_password: true }).eq("id", data.userId);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("Você não pode excluir a si mesmo");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const markPasswordChanged = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").update({ must_change_password: false }).eq("id", context.userId);
    return { ok: true };
  });

export const seedInitialUsers = createServerFn({ method: "POST" })
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("profiles").select("*", { count: "exact", head: true });
    if ((count ?? 0) > 0) return { seeded: false as const, reason: "already-initialized" };
    const seed = [
      { username: "beatriz.chaves", full_name: "Beatriz Chaves", role: "admin" as const },
      { username: "bruna.araujo", full_name: "Bruna Araujo", role: "operator" as const },
      { username: "patricia.guimaraes", full_name: "Patricia Guimaraes", role: "viewer" as const },
    ];
    for (const u of seed) {
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email: emailFor(u.username),
        password: "prevermed",
        email_confirm: true,
        user_metadata: { username: u.username, full_name: u.full_name, must_change_password: true },
      });
      if (error || !data.user) throw new Error(`${u.username}: ${error?.message || "sem usuário"}`);
      await supabaseAdmin.from("profiles").upsert({
        id: data.user.id, username: u.username, full_name: u.full_name, must_change_password: true,
      });
      const { error: rerr } = await supabaseAdmin.from("user_roles").insert({ user_id: data.user.id, role: u.role });
      if (rerr) throw new Error(`role ${u.username}: ${rerr.message}`);
    }
    return { seeded: true as const };
  });
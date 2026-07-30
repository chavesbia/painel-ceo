import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Mescla um grupo de duplicatas "a pagar": mantém a linha escolhida pelo
 * revisor e remove as demais linhas do grupo informadas.
 */
export const mergeDuplicateGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        keepId: z.string().uuid(),
        removeIds: z.array(z.string().uuid()).min(1),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const [{ data: isOp }, { data: isAdmin }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "operator" }),
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    ]);
    if (!isOp && !isAdmin) throw new Error("Sem permissão para mesclar duplicatas");

    if (data.removeIds.includes(data.keepId)) throw new Error("A linha mantida não pode ser removida");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error: readErr } = await supabaseAdmin
      .from("invoices")
      .select("id,kind,numero,entidade_doc,unidade_negocio,situacao")
      .in("id", [data.keepId, ...data.removeIds]);
    if (readErr) throw new Error(readErr.message);

    const keep = rows?.find((r) => r.id === data.keepId);
    if (!keep) throw new Error("Linha a manter não encontrada");
    if (keep.kind !== "payable") throw new Error("Mesclagem disponível apenas para faturas a pagar");

    const key = (r: { numero: string | null; entidade_doc: string | null; unidade_negocio: string | null }) =>
      [r.numero ?? "", r.entidade_doc ?? "", r.unidade_negocio ?? ""].join("||");
    const keepKey = key(keep);

    for (const r of rows ?? []) {
      if (r.id === data.keepId) continue;
      if (r.kind !== "payable" || key(r) !== keepKey) throw new Error("As linhas não pertencem ao mesmo grupo");
      if ((r.situacao || "").toLowerCase().startsWith("paga")) {
        throw new Error("Grupo já possui linha Paga — tratado pela regra automática");
      }
    }

    const { error: delErr } = await supabaseAdmin.from("invoices").delete().in("id", data.removeIds);
    if (delErr) throw new Error(delErr.message);

    return { ok: true, removed: data.removeIds.length };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RowSchema = z.object({
  kind: z.enum(["receivable", "payable"]),
  numero: z.string(),
  unidade_negocio: z.string().nullable(),
  entidade: z.string().nullable(),
  entidade_doc: z.string().nullable(),
  valor_parcela: z.number(),
  valor_pago: z.number(),
  total_fatura: z.number().nullable(),
  situacao: z.string().nullable(),
  data_competencia: z.string().nullable(),
  data_vencimento: z.string().nullable(),
  data_pagamento: z.string().nullable(),
  forma_pagamento: z.string().nullable(),
  conta_bancaria: z.string().nullable(),
  plano_contas: z.string().nullable(),
  centro_custos: z.string().nullable(),
  origem: z.string().nullable(),
  descricao: z.string().nullable(),
  numero_nota: z.string().nullable(),
  data_cadastro: z.string().nullable(),
  criado_por: z.string().nullable(),
});

const InputSchema = z.object({
  kind: z.enum(["receivable", "payable"]),
  filename: z.string(),
  total: z.number(),
  skipped: z.number(),
  rows: z.array(RowSchema),
});

export const importInvoices = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: imp, error: impErr } = await supabaseAdmin
      .from("imports")
      .insert({
        kind: data.kind,
        filename: data.filename,
        rows_total: data.total,
        rows_skipped: data.skipped,
        rows_imported: 0,
      })
      .select("id")
      .single();
    if (impErr || !imp) throw new Error(impErr?.message || "Falha ao criar import");

    const withImport = data.rows.map((r) => ({ ...r, import_id: imp.id }));

    // Deduplicate rows on the same conflict key (kind,numero,entidade_doc,data_vencimento)
    // Postgres rejects upsert when a single batch contains two rows that match the same target row.
    const seen = new Map<string, typeof withImport[number]>();
    for (const r of withImport) {
      const key = `${r.kind}||${r.numero}||${r.entidade_doc ?? ""}||${r.data_vencimento ?? ""}`;
      seen.set(key, r); // last occurrence wins
    }
    const deduped = Array.from(seen.values());

    // Chunked upsert
    let imported = 0;
    const chunk = 500;
    for (let i = 0; i < deduped.length; i += chunk) {
      const slice = deduped.slice(i, i + chunk);
      const { error } = await supabaseAdmin
        .from("invoices")
        .upsert(slice, { onConflict: "kind,numero,entidade_doc,data_vencimento" });
      if (error) throw new Error(`Erro no lote ${i}: ${error.message}`);
      imported += slice.length;
    }

    await supabaseAdmin
      .from("imports")
      .update({ rows_imported: imported })
      .eq("id", imp.id);

    return { importId: imp.id, imported, skipped: data.skipped, total: data.total };
  });

export const deleteImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: isOp } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "operator",
    });
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isOp && !isAdmin) throw new Error("Sem permissão para excluir importações");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: invErr } = await supabaseAdmin.from("invoices").delete().eq("import_id", data.id);
    if (invErr) throw new Error(invErr.message);
    const { error: impErr } = await supabaseAdmin.from("imports").delete().eq("id", data.id);
    if (impErr) throw new Error(impErr.message);
    return { ok: true };
  });
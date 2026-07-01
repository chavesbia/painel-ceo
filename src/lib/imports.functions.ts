import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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

    // Chunked upsert
    let imported = 0;
    const chunk = 500;
    for (let i = 0; i < withImport.length; i += chunk) {
      const slice = withImport.slice(i, i + chunk);
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
import type { ImportInput } from "./imports.schema";

const cleanText = (v: string | null | undefined) => {
  const s = (v ?? "").toString().replace(/^\uFEFF/, "").replace(/\s+/g, " ").trim();
  return s || null;
};

// Chave de identidade por tipo (espelha o índice único invoices_identity_key):
// - receivable: kind, numero, entidade_doc, unidade_negocio
// - payable:    idem + data_vencimento
const identityKey = (r: {
  kind: string;
  numero: string;
  entidade_doc: string | null;
  unidade_negocio: string | null;
  data_vencimento: string | null;
}) =>
  [
    r.kind,
    r.numero ?? "",
    r.entidade_doc ?? "",
    r.unidade_negocio ?? "",
    r.kind === "payable" ? (r.data_vencimento ?? "") : "",
  ].join("||");

export async function runImportInvoices(data: ImportInput) {
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

  const withImport = data.rows.map((r) => ({
    ...r,
    import_id: imp.id,
    numero: cleanText(r.numero) || "",
    entidade_doc: cleanText(r.entidade_doc),
    unidade_negocio: cleanText(r.unidade_negocio),
    data_vencimento: cleanText(r.data_vencimento),
  }));

  // Postgres rejeita upsert quando o mesmo lote contém duas linhas que atingem a mesma linha alvo.
  const seen = new Map<string, (typeof withImport)[number]>();
  for (const r of withImport) seen.set(identityKey(r), r);
  const deduped = Array.from(seen.values());

  const { data: existingRows } = await supabaseAdmin
    .from("invoices")
    .select("kind, numero, entidade_doc, unidade_negocio, data_vencimento")
    .eq("kind", data.kind);
  const existingKeys = new Set((existingRows ?? []).map((r) => identityKey(r)));
  let rowsInserted = 0;
  let rowsUpdated = 0;
  for (const r of deduped) {
    if (existingKeys.has(identityKey(r))) rowsUpdated += 1;
    else rowsInserted += 1;
  }

  const onConflict = "kind,numero,entidade_doc,unidade_negocio,dedupe_vencimento";
  let imported = 0;
  const chunk = 500;
  for (let i = 0; i < deduped.length; i += chunk) {
    const slice = deduped.slice(i, i + chunk);
    const { error } = await supabaseAdmin.from("invoices").upsert(slice, { onConflict });
    if (error) {
      const errorText = [error.message, error.details, error.hint, error.code].filter(Boolean).join(" ");
      if (/affect row a second time|ON CONFLICT DO UPDATE/i.test(errorText)) {
        for (const row of slice) {
          const { error: e2 } = await supabaseAdmin.from("invoices").upsert([row], { onConflict });
          if (e2) throw new Error(`Erro no registro ${row.numero}: ${e2.message}`);
          imported += 1;
        }
      } else {
        throw new Error(`Erro no lote ${i}: ${error.message}`);
      }
    } else {
      imported += slice.length;
    }
  }

  await supabaseAdmin
    .from("imports")
    .update({ rows_imported: imported, rows_inserted: rowsInserted, rows_updated: rowsUpdated })
    .eq("id", imp.id);

  const { data: allInvoices } = await supabaseAdmin
    .from("invoices")
    .select("kind, numero, entidade, unidade_negocio, data_vencimento, valor_parcela");
  const groupCounts = new Map<string, { qtd: number; valor: number }>();
  for (const r of allInvoices ?? []) {
    const k = [
      r.kind,
      r.numero ?? "",
      r.entidade ?? "",
      r.unidade_negocio ?? "",
      r.data_vencimento ?? "",
      String(r.valor_parcela ?? 0),
    ].join("||");
    const cur = groupCounts.get(k) ?? { qtd: 0, valor: Number(r.valor_parcela) || 0 };
    cur.qtd += 1;
    groupCounts.set(k, cur);
  }
  let dupGroups = 0,
    dupExcess = 0,
    dupValor = 0;
  for (const g of groupCounts.values()) {
    if (g.qtd > 1) {
      dupGroups += 1;
      dupExcess += g.qtd - 1;
      dupValor += (g.qtd - 1) * g.valor;
    }
  }
  const dup = { groups: dupGroups, excess: dupExcess, valor: Number(dupValor.toFixed(2)) };

  await supabaseAdmin.from("import_health_checks").insert({
    source: "import",
    import_id: imp.id,
    rows_inserted: rowsInserted,
    rows_updated: rowsUpdated,
    rows_skipped: data.skipped,
    duplicate_groups: dup.groups,
    duplicate_excess_rows: dup.excess,
    duplicate_excess_valor: dup.valor,
    details: { filename: data.filename, kind: data.kind, total: data.total },
  });

  return {
    importId: imp.id,
    imported,
    inserted: rowsInserted,
    updated: rowsUpdated,
    skipped: data.skipped,
    total: data.total,
    duplicates: dup,
  };
}

export async function runDeleteImport(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error: invErr } = await supabaseAdmin.from("invoices").delete().eq("import_id", id);
  if (invErr) throw new Error(invErr.message);
  const { error: impErr } = await supabaseAdmin.from("imports").delete().eq("id", id);
  if (impErr) throw new Error(impErr.message);
  return { ok: true };
}

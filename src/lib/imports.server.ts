import type { ImportInput } from "./imports.schema";

const normalizeUnidade = (v: string | null | undefined) => {
  let s = (v ?? "").toString().replace(/^\uFEFF/, "").replace(/\s+/g, " ").trim();
  if (!s) return null;

  // 1. "CNPJ | Nome" -> apenas números do CNPJ
  if (s.includes("|")) {
    const part = s.split("|")[0].trim();
    const cnpjOnly = part.replace(/\D/g, "");
    if (cnpjOnly.length >= 11) return cnpjOnly; // CNPJ ou CPF
  }

  // 2. "PreverMed" -> CNPJ específico
  if (s.toLowerCase() === "prevermed") {
    return "28309721000105";
  }

  return s;
};

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

  // Filtro de "linhas de rodapé" (entidade_doc vazio)
  const rowsWithEntidade = data.rows.filter(r => cleanText(r.entidade_doc));
  const footerRowsCount = data.rows.length - rowsWithEntidade.length;

  const { data: imp, error: impErr } = await supabaseAdmin
    .from("imports")
    .insert({
      kind: data.kind,
      filename: data.filename,
      rows_total: data.total,
      rows_skipped: data.skipped + footerRowsCount,
      rows_imported: 0,
      notes: footerRowsCount > 0 ? `${footerRowsCount} linhas de rodapé descartadas` : null
    })
    .select("id")
    .single();
  if (impErr || !imp) throw new Error(impErr?.message || "Falha ao criar import");

  const withImport = rowsWithEntidade.map((r) => ({
    ...r,
    import_id: imp.id,
    numero: cleanText(r.numero) || "",
    entidade_doc: cleanText(r.entidade_doc),
    unidade_negocio: normalizeUnidade(r.unidade_negocio),
    data_vencimento: cleanText(r.data_vencimento),
  }));

  // Postgres rejeita upsert quando o mesmo lote contém duas linhas que atingem a mesma linha alvo.
  const seen = new Map<string, (typeof withImport)[number]>();
  for (const r of withImport) seen.set(identityKey(r), r);
  const deduped = Array.from(seen.values());

  const existingKeys = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data: page, error: pageErr } = await supabaseAdmin
      .from("invoices")
      .select("kind, numero, entidade_doc, unidade_negocio, data_vencimento")
      .eq("kind", data.kind)
      .order("id")
      .range(from, from + 999);
    if (pageErr) throw new Error(pageErr.message);
    for (const r of page ?? []) existingKeys.add(identityKey(r));
    if (!page || page.length < 1000) break;
  }
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

  // "A pagar": quando o ERP muda o vencimento ao pagar, a linha antiga
  // "Pendente" (outro vencimento) fica órfã. Marca-a como Paga.
  if (data.kind === "payable") {
    const paid = deduped.filter((r) => /^paga/i.test(String(r.situacao ?? "")));
    for (const r of paid) {
      let q = supabaseAdmin
        .from("invoices")
        .update({ situacao: "Paga", data_pagamento: r.data_pagamento ?? null, import_id: imp.id })
        .eq("kind", "payable")
        .eq("numero", r.numero)
        .in("situacao", ["Pendente", "Protestada"])
        .neq("data_vencimento", r.data_vencimento ?? "");
      q = r.entidade_doc ? q.eq("entidade_doc", r.entidade_doc) : q.is("entidade_doc", null);
      q = r.unidade_negocio ? q.eq("unidade_negocio", r.unidade_negocio) : q.is("unidade_negocio", null);
      await q;
    }
  }

  await supabaseAdmin
    .from("imports")
    .update({ 
      rows_imported: imported, 
      rows_inserted: rowsInserted, 
      rows_updated: rowsUpdated,
      rows_skipped: data.skipped + footerRowsCount // Atualiza o total de ignorados no registro final
    })
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

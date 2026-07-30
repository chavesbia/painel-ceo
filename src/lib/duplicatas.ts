import { supabase } from "@/integrations/supabase/client";

export type DupRow = {
  id: string;
  numero: string;
  entidade: string | null;
  entidade_doc: string | null;
  unidade_negocio: string | null;
  data_vencimento: string | null;
  valor_parcela: number;
  valor_pago: number;
  situacao: string | null;
};

export type DupGroup = {
  key: string;
  numero: string;
  entidade: string;
  unidade_negocio: string;
  entidade_doc: string | null;
  rows: DupRow[];
  spreadDays: number;
  valorTotal: number;
};

export const dupKey = (r: {
  numero: string | null;
  entidade_doc: string | null;
  unidade_negocio: string | null;
}) => [r.numero ?? "", r.entidade_doc ?? "", r.unidade_negocio ?? ""].join("||");

const isPaga = (s: string | null) => (s || "").toLowerCase().startsWith("paga");
const isCancelada = (s: string | null) => (s || "").toLowerCase().startsWith("cancel");

/**
 * Grupos de faturas "a pagar" com mesmo número + documento da entidade +
 * unidade de negócio, porém vencimentos diferentes, e SEM nenhuma linha "Paga".
 * Grupos que já têm uma linha paga seguem a regra automática existente.
 */
export function buildDupGroups(rows: DupRow[]): DupGroup[] {
  const map = new Map<string, DupRow[]>();
  for (const r of rows) {
    if (isCancelada(r.situacao)) continue;
    const k = dupKey(r);
    const arr = map.get(k) ?? [];
    arr.push(r);
    map.set(k, arr);
  }

  const groups: DupGroup[] = [];
  for (const [key, arr] of map) {
    if (arr.length < 2) continue;
    if (arr.some((r) => isPaga(r.situacao))) continue; // já resolvido pela regra automática
    const dates = new Set(arr.map((r) => r.data_vencimento ?? ""));
    if (dates.size < 2) continue;
    const ordered = [...arr].sort((a, b) => (a.data_vencimento ?? "").localeCompare(b.data_vencimento ?? ""));
    const first = ordered[0].data_vencimento;
    const last = ordered[ordered.length - 1].data_vencimento;
    const spreadDays =
      first && last
        ? Math.abs(Math.round((new Date(last + "T00:00:00").getTime() - new Date(first + "T00:00:00").getTime()) / 86400000))
        : 0;
    groups.push({
      key,
      numero: ordered[0].numero,
      entidade: (ordered[0].entidade || "—").toUpperCase(),
      unidade_negocio: ordered[0].unidade_negocio || "—",
      entidade_doc: ordered[0].entidade_doc,
      rows: ordered,
      spreadDays,
      valorTotal: ordered.reduce((s, r) => s + (Number(r.valor_parcela) || 0), 0),
    });
  }

  return groups.sort((a, b) => a.spreadDays - b.spreadDays || b.valorTotal - a.valorTotal);
}

export async function loadDupGroups(): Promise<DupGroup[]> {
  const pageSize = 1000;
  let from = 0;
  const all: DupRow[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from("invoices")
      .select("id,numero,entidade,entidade_doc,unidade_negocio,data_vencimento,valor_parcela,valor_pago,situacao")
      .eq("kind", "payable")
      .order("numero", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = (data as DupRow[] | null) || [];
    all.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
    if (from > 200000) break;
  }
  return buildDupGroups(all);
}

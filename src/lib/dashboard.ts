import { supabase } from "@/integrations/supabase/client";

export type DashboardData = {
  hasData: boolean;
  ultimaImportacao: string | null;
  aReceberTotal: number;
  aReceberVencidosCount: number;
  aReceberVencidosValor: number;
  aPagarTotal: number;
  aPagarVencidosCount: number;
  aPagarVencidosValor: number;
  hoje: { receber: number; pagar: number; vencidos: number };
  semana: { receber: number; pagar: number };
  fluxo: { dia: string; label: string; entrada: number; saida: number; saldo: number }[];
  empresas: { nome: string; valor: number; pct: number }[];
  bancos: { nome: string; valor: number; pct: number }[];
  topVencidos: {
    fornecedor: string; empresa: string; venc: string; dias: number; valor: number;
  }[];
};

type InvoiceRow = {
  kind: "receivable" | "payable";
  numero: string;
  unidade_negocio: string | null;
  entidade: string | null;
  conta_bancaria: string | null;
  valor_parcela: number;
  valor_pago: number;
  situacao: string | null;
  data_vencimento: string | null;
  data_pagamento: string | null;
};

const ymd = (d: Date) => d.toISOString().slice(0, 10);

function openAmount(r: InvoiceRow): number {
  return Math.max(0, Number(r.valor_parcela) - Number(r.valor_pago));
}
function isOpen(r: InvoiceRow): boolean {
  const s = (r.situacao || "").toLowerCase();
  if (s.startsWith("paga")) return false;
  return openAmount(r) > 0 && !!r.data_vencimento;
}

export async function loadDashboard(): Promise<DashboardData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 30);
  const past = new Date(today);
  past.setDate(past.getDate() - 365);

  const [invRes, impRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("kind,numero,unidade_negocio,entidade,conta_bancaria,valor_parcela,valor_pago,situacao,data_vencimento,data_pagamento")
      .gte("data_vencimento", ymd(past))
      .lte("data_vencimento", ymd(horizon))
      .limit(50000),
    supabase.from("imports").select("created_at").order("created_at", { ascending: false }).limit(1),
  ]);

  const rows = (invRes.data as InvoiceRow[] | null) || [];
  const ultima = impRes.data?.[0]?.created_at || null;

  if (rows.length === 0) {
    return {
      hasData: false,
      ultimaImportacao: ultima,
      aReceberTotal: 0, aReceberVencidosCount: 0, aReceberVencidosValor: 0,
      aPagarTotal: 0, aPagarVencidosCount: 0, aPagarVencidosValor: 0,
      hoje: { receber: 0, pagar: 0, vencidos: 0 },
      semana: { receber: 0, pagar: 0 },
      fluxo: [], empresas: [], bancos: [], topVencidos: [],
    };
  }

  const recv = rows.filter((r) => r.kind === "receivable" && isOpen(r));
  const pay = rows.filter((r) => r.kind === "payable" && isOpen(r));

  const todayStr = ymd(today);
  const inWeekLimit = new Date(today); inWeekLimit.setDate(inWeekLimit.getDate() + 7);
  const weekStr = ymd(inWeekLimit);

  const aReceberTotal = recv.reduce((s, r) => s + openAmount(r), 0);
  const aPagarTotal = pay.reduce((s, r) => s + openAmount(r), 0);
  const recvVenc = recv.filter((r) => r.data_vencimento! < todayStr);
  const payVenc = pay.filter((r) => r.data_vencimento! < todayStr);

  const hoje = {
    receber: recv.filter((r) => r.data_vencimento === todayStr).reduce((s, r) => s + openAmount(r), 0),
    pagar: pay.filter((r) => r.data_vencimento === todayStr).reduce((s, r) => s + openAmount(r), 0),
    vencidos: recvVenc.length + payVenc.length,
  };
  const semana = {
    receber: recv.filter((r) => r.data_vencimento! >= todayStr && r.data_vencimento! <= weekStr).reduce((s, r) => s + openAmount(r), 0),
    pagar: pay.filter((r) => r.data_vencimento! >= todayStr && r.data_vencimento! <= weekStr).reduce((s, r) => s + openAmount(r), 0),
  };

  // Fluxo projetado 30d — saldo começa em 0 (tesouraria será Fase 2)
  const buckets = new Map<string, { entrada: number; saida: number }>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today); d.setDate(d.getDate() + i);
    buckets.set(ymd(d), { entrada: 0, saida: 0 });
  }
  recv.filter((r) => r.data_vencimento! >= todayStr).forEach((r) => {
    const b = buckets.get(r.data_vencimento!); if (b) b.entrada += openAmount(r);
  });
  pay.filter((r) => r.data_vencimento! >= todayStr).forEach((r) => {
    const b = buckets.get(r.data_vencimento!); if (b) b.saida += openAmount(r);
  });
  let saldo = 0;
  const fluxo = Array.from(buckets.entries()).map(([d, v]) => {
    saldo += v.entrada - v.saida;
    const dt = new Date(d + "T00:00:00");
    return {
      dia: d,
      label: dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      entrada: v.entrada, saida: v.saida, saldo,
    };
  });

  // Empresas
  const empMap = new Map<string, number>();
  [...recv, ...pay].forEach((r) => {
    const nome = shortName(r.unidade_negocio) || "Não informado";
    const delta = r.kind === "receivable" ? openAmount(r) : -openAmount(r);
    empMap.set(nome, (empMap.get(nome) || 0) + delta);
  });
  const empresas = Array.from(empMap.entries())
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => Math.abs(b.valor) - Math.abs(a.valor))
    .slice(0, 5);
  const empTotal = empresas.reduce((s, e) => s + Math.abs(e.valor), 0) || 1;
  const empresasWithPct = empresas.map((e) => ({ ...e, pct: Math.round((Math.abs(e.valor) / empTotal) * 100) }));

  // Bancos (por conta de pagamento)
  const bancoMap = new Map<string, number>();
  [...recv, ...pay].forEach((r) => {
    if (!r.conta_bancaria) return;
    const nome = (r.conta_bancaria.split("|")[0] || r.conta_bancaria).trim();
    bancoMap.set(nome, (bancoMap.get(nome) || 0) + openAmount(r));
  });
  const bancos = Array.from(bancoMap.entries())
    .map(([nome, valor]) => ({ nome, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);
  const bTotal = bancos.reduce((s, b) => s + b.valor, 0) || 1;
  const bancosWithPct = bancos.map((b) => ({ ...b, pct: Math.round((b.valor / bTotal) * 100) }));

  const topVencidos = payVenc
    .map((r) => ({
      fornecedor: shortName(r.entidade) || "-",
      empresa: shortName(r.unidade_negocio) || "-",
      venc: r.data_vencimento!,
      dias: Math.floor((today.getTime() - new Date(r.data_vencimento! + "T00:00:00").getTime()) / 86400000),
      valor: openAmount(r),
    }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);

  return {
    hasData: true,
    ultimaImportacao: ultima,
    aReceberTotal, aReceberVencidosCount: recvVenc.length,
    aReceberVencidosValor: recvVenc.reduce((s, r) => s + openAmount(r), 0),
    aPagarTotal, aPagarVencidosCount: payVenc.length,
    aPagarVencidosValor: payVenc.reduce((s, r) => s + openAmount(r), 0),
    hoje, semana, fluxo,
    empresas: empresasWithPct, bancos: bancosWithPct, topVencidos,
  };
}

function shortName(v: string | null | undefined): string | null {
  if (!v) return null;
  // "CNPJ | Nome" -> Nome; "Nome - CNPJ" -> Nome
  if (v.includes(" | ")) return v.split(" | ")[1]?.trim() || v.trim();
  if (v.includes(" - ")) return v.split(" - ")[0]?.trim();
  return v.trim();
}
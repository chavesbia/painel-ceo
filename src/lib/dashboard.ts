import { supabase } from "@/integrations/supabase/client";

export type DashboardData = {
  hasData: boolean;
  ultimaImportacao: string | null;
  saldoBancarioTotal: number;
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
  saldos: { empresa: string; conta: string; saldo: number; data: string }[];
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

type CashBalanceRow = {
  company_name: string;
  account_name: string;
  balance: number;
  balance_date: string;
  updated_at: string;
};

const ymd = (d: Date) => d.toISOString().slice(0, 10);

function openAmount(r: InvoiceRow): number {
  return Math.max(0, Number(r.valor_parcela) - Number(r.valor_pago));
}
function isOpen(r: InvoiceRow): boolean {
  const s = (r.situacao || "").toLowerCase();
  if (s.startsWith("paga")) return false;
  if (s.startsWith("cancel")) return false;
  return openAmount(r) > 0 && !!r.data_vencimento;
}

async function fetchAllInvoices(pastStr: string): Promise<InvoiceRow[]> {
  const pageSize = 1000;
  let from = 0;
  const all: InvoiceRow[] = [];
  // Traz tudo com vencimento >= 1 ano atrás (sem cortar futuro) para KPIs corretos.
  // O gráfico de fluxo filtra a janela de 30 dias localmente.
  // Paginado porque PostgREST limita a 1000 por request.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from("invoices")
      .select("kind,numero,unidade_negocio,entidade,conta_bancaria,valor_parcela,valor_pago,situacao,data_vencimento,data_pagamento")
      .gte("data_vencimento", pastStr)
      .order("data_vencimento", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = (data as InvoiceRow[] | null) || [];
    all.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
    if (from > 200000) break; // guarda
  }
  return all;
}

export async function loadDashboard(): Promise<DashboardData> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 30);
  const past = new Date(today);
  past.setDate(past.getDate() - 365);

  const [rows, impRes, cashRes] = await Promise.all([
    fetchAllInvoices(ymd(past)),
    supabase.from("imports").select("created_at").order("created_at", { ascending: false }).limit(1),
    supabase
      .from("cash_balances")
      .select("company_name,account_name,balance,balance_date,updated_at")
      .order("balance_date", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(5000),
  ]);

  const cashRows = (cashRes.data as CashBalanceRow[] | null) || [];
  const ultima = impRes.data?.[0]?.created_at || null;

  const latestCash = new Map<string, CashBalanceRow>();
  cashRows.forEach((row) => {
    const key = `${row.company_name.trim().toLowerCase()}|${row.account_name.trim().toLowerCase()}`;
    if (!latestCash.has(key)) latestCash.set(key, row);
  });
  const saldos = Array.from(latestCash.values())
    .map((row) => ({
      empresa: row.company_name,
      conta: row.account_name,
      saldo: Number(row.balance) || 0,
      data: row.balance_date,
    }))
    .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo));
  const saldoBancarioTotal = saldos.reduce((sum, row) => sum + row.saldo, 0);

  if (rows.length === 0 && saldos.length === 0) {
    return {
      hasData: false,
      ultimaImportacao: ultima,
      saldoBancarioTotal: 0,
      aReceberTotal: 0, aReceberVencidosCount: 0, aReceberVencidosValor: 0,
      aPagarTotal: 0, aPagarVencidosCount: 0, aPagarVencidosValor: 0,
      hoje: { receber: 0, pagar: 0, vencidos: 0 },
      semana: { receber: 0, pagar: 0 },
      fluxo: [], empresas: [], bancos: [], saldos: [], topVencidos: [],
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

  // Fluxo projetado 30d — saldo começa com os saldos bancários cadastrados.
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
  let saldo = saldoBancarioTotal;
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
    saldoBancarioTotal,
    aReceberTotal, aReceberVencidosCount: recvVenc.length,
    aReceberVencidosValor: recvVenc.reduce((s, r) => s + openAmount(r), 0),
    aPagarTotal, aPagarVencidosCount: payVenc.length,
    aPagarVencidosValor: payVenc.reduce((s, r) => s + openAmount(r), 0),
    hoje, semana, fluxo,
    empresas: empresasWithPct, bancos: bancosWithPct, saldos, topVencidos,
  };
}

function shortName(v: string | null | undefined): string | null {
  if (!v) return null;
  // "CNPJ | Nome" -> Nome; "Nome - CNPJ" -> Nome
  if (v.includes(" | ")) return v.split(" | ")[1]?.trim() || v.trim();
  if (v.includes(" - ")) return v.split(" - ")[0]?.trim();
  return v.trim();
}
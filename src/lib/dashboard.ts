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
  hoje: { receber: number; pagar: number; vencidos: number; vencidosValor: number };
  semana: { receber: number; pagar: number };
  fluxo: { dia: string; label: string; entrada: number; saida: number; saldo: number }[];
  empresas: { cnpj: string | null; nome: string; valor: number; pct: number }[];
  bancos: { nome: string; valor: number; pct: number }[];
  saldos: { empresaCnpj: string | null; empresaNome: string; conta: string; saldo: number; data: string }[];
  topVencidos: {
    fornecedor: string; descricao: string | null; empresaCnpj: string | null; empresaNome: string; venc: string; dias: number; valor: number;
  }[];
  topClientesVencidos: {
    cliente: string; descricao: string | null; empresaCnpj: string | null; empresaNome: string; venc: string; dias: number; valor: number;
  }[];
};

type InvoiceRow = {
  kind: "receivable" | "payable";
  numero: string;
  unidade_negocio: string | null;
  entidade: string | null;
  descricao: string | null;
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
  // Só faturas em aberto (Pendente/Protestada) — reduz drasticamente o payload
  // (não precisamos das Pagas/Canceladas para os KPIs do painel).
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase
      .from("invoices")
      .select("kind,numero,unidade_negocio,entidade,descricao,conta_bancaria,valor_parcela,valor_pago,situacao,data_vencimento,data_pagamento")
      .gte("data_vencimento", pastStr)
      .in("situacao", ["Pendente", "Protestada"])
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
  horizon.setDate(horizon.getDate() + 180);
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
    .map((row) => {
      const info = companyInfo(row.company_name);
      return {
        empresaCnpj: info.cnpj,
        empresaNome: info.nome,
        conta: row.account_name,
        saldo: Number(row.balance) || 0,
        data: row.balance_date,
      };
    })
    .sort((a, b) => Math.abs(b.saldo) - Math.abs(a.saldo));
  const saldoBancarioTotal = saldos.reduce((sum, row) => sum + row.saldo, 0);

  if (rows.length === 0 && saldos.length === 0) {
    return {
      hasData: false,
      ultimaImportacao: ultima,
      saldoBancarioTotal: 0,
      aReceberTotal: 0, aReceberVencidosCount: 0, aReceberVencidosValor: 0,
      aPagarTotal: 0, aPagarVencidosCount: 0, aPagarVencidosValor: 0,
      hoje: { receber: 0, pagar: 0, vencidos: 0, vencidosValor: 0 },
      semana: { receber: 0, pagar: 0 },
      fluxo: [], empresas: [], bancos: [], saldos: [], topVencidos: [], topClientesVencidos: [],
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
    vencidosValor:
      recvVenc.reduce((s, r) => s + openAmount(r), 0) +
      payVenc.reduce((s, r) => s + openAmount(r), 0),
  };
  const semana = {
    receber: recv.filter((r) => r.data_vencimento! >= todayStr && r.data_vencimento! <= weekStr).reduce((s, r) => s + openAmount(r), 0),
    pagar: pay.filter((r) => r.data_vencimento! >= todayStr && r.data_vencimento! <= weekStr).reduce((s, r) => s + openAmount(r), 0),
  };

  // Fluxo projetado 180d — saldo começa com os saldos bancários cadastrados.
  // O componente filtra a janela (7/15/30/60/90/180d).
  const buckets = new Map<string, { entrada: number; saida: number }>();
  for (let i = 0; i < 180; i++) {
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
  const empMap = new Map<string, { cnpj: string | null; nome: string; valor: number }>();
  [...recv, ...pay].forEach((r) => {
    const info = companyInfo(r.unidade_negocio);
    const key = `${info.cnpj || ""}|${info.nome}`;
    const delta = r.kind === "receivable" ? openAmount(r) : -openAmount(r);
    const cur = empMap.get(key) || { cnpj: info.cnpj, nome: info.nome, valor: 0 };
    cur.valor += delta;
    empMap.set(key, cur);
  });
  const empresas = Array.from(empMap.values())
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
    .map((r) => {
      const info = companyInfo(r.unidade_negocio);
      return {
        fornecedor: shortName(r.entidade) || "-",
        descricao: r.descricao?.trim() || null,
        empresaCnpj: info.cnpj,
        empresaNome: info.nome,
        venc: r.data_vencimento!,
        dias: Math.floor((today.getTime() - new Date(r.data_vencimento! + "T00:00:00").getTime()) / 86400000),
        valor: openAmount(r),
      };
    })
    .sort((a, b) => b.valor - a.valor);

  const topClientesVencidos = recvVenc
    .map((r) => {
      const info = companyInfo(r.unidade_negocio);
      return {
        cliente: shortName(r.entidade) || "-",
        descricao: r.descricao?.trim() || null,
        empresaCnpj: info.cnpj,
        empresaNome: info.nome,
        venc: r.data_vencimento!,
        dias: Math.floor((today.getTime() - new Date(r.data_vencimento! + "T00:00:00").getTime()) / 86400000),
        valor: openAmount(r),
      };
    })
    .sort((a, b) => b.valor - a.valor);

  return {
    hasData: true,
    ultimaImportacao: ultima,
    saldoBancarioTotal,
    aReceberTotal, aReceberVencidosCount: recvVenc.length,
    aReceberVencidosValor: recvVenc.reduce((s, r) => s + openAmount(r), 0),
    aPagarTotal, aPagarVencidosCount: payVenc.length,
    aPagarVencidosValor: payVenc.reduce((s, r) => s + openAmount(r), 0),
    hoje, semana, fluxo,
    empresas: empresasWithPct, bancos: bancosWithPct, saldos, topVencidos, topClientesVencidos,
  };
}

function shortName(v: string | null | undefined): string | null {
  if (!v) return null;
  // "CNPJ | Nome" -> Nome; "Nome - CNPJ" -> Nome
  if (v.includes(" | ")) return v.split(" | ")[1]?.trim() || v.trim();
  if (v.includes(" - ")) return v.split(" - ")[0]?.trim();
  return v.trim();
}

// Converte "PREVER ALPHA ESTETICA E ASSESSORIA" → "Prever Alpha Estetica e Assessoria"
// Mantém siglas curtas (<=3, ex.: S/A) em caixa alta.
function titleCase(input: string): string {
  const lowers = new Set(["de", "da", "do", "das", "dos", "e", "em", "para", "com", "a", "o"]);
  return input
    .toLowerCase()
    .split(/(\s+|-|\/)/)
    .map((part, idx) => {
      if (/^\s+$/.test(part) || part === "-" || part === "/") return part;
      if (lowers.has(part) && idx !== 0) return part;
      // Preserva parênteses: "(matriz)" → "(Matriz)"
      return part.replace(/([a-záéíóúâêôãõç])([a-záéíóúâêôãõç]*)/gi, (_, first: string, rest: string) => first.toUpperCase() + rest);
    })
    .join("");
}

// Mapeia trechos do nome (em minúsculas) para CNPJ e nome canônico de exibição.
// A ordem importa: entradas mais específicas devem vir antes das genéricas.
const CNPJ_BY_NAME: { key: string; cnpj: string; display?: string }[] = [
  { key: "prever alpha", cnpj: "37.260.594/0001-80", display: "Prever Alpha Estetica e Assessoria" },
  { key: "prever centro medico", cnpj: "96.492.707/0001-31", display: "Prever Centro Medico" },
  { key: "prever medical group", cnpj: "28.309.721/0001-05", display: "Prever Medical Group" },
  { key: "prevermed medicina ocupacional (filial)", cnpj: "46.638.275/0002-37", display: "Prevermed Medicina Ocupacional (Filial)" },
  { key: "prevermed medicina ocupacional", cnpj: "46.638.275/0001-56", display: "Prevermed Medicina Ocupacional" },
  // "Prevermed" (sem sufixo) é o nome fantasia da Prever Medical Group.
  { key: "prevermed", cnpj: "28.309.721/0001-05", display: "Prever Medical Group" },
];

function companyInfo(v: string | null | undefined): { cnpj: string | null; nome: string } {
  const raw = shortName(v);
  if (!raw) return { cnpj: null, nome: "Não informado" };
  // Casa por CNPJ quando o campo vier apenas com o número (ex.: cash_balances.company_name = "28.309.721/0001-05").
  const cnpjMatch = raw.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/);
  if (cnpjMatch) {
    const byCnpj = CNPJ_BY_NAME.find((c) => c.cnpj === cnpjMatch[0]);
    if (byCnpj) return { cnpj: byCnpj.cnpj, nome: byCnpj.display || titleCase(raw) };
  }
  const nome = titleCase(raw);
  const norm = nome.toLowerCase();
  const match = CNPJ_BY_NAME.find((c) => norm.includes(c.key));
  return { cnpj: match ? match.cnpj : null, nome: match?.display || nome };
}
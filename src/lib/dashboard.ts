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
  fluxoRealista: { dia: string; label: string; entrada: number; saida: number; saldo: number }[];
  recuperacao: {
    exposicaoVencida: number;   // total de recebíveis vencidos (valor de face)
    recuperacaoEsperada: number; // após aplicar % por faixa
    perdaEsperada: number;       // exposicao - recuperacao
    taxas: { a30: number; a60: number; a90: number; mais: number };
  };
  empresas: { cnpj: string | null; nome: string; receber: number; pagar: number; valor: number; pct: number }[];
  bancos: { nome: string; valor: number; pct: number }[];
  saldos: { empresaCnpj: string | null; empresaNome: string; conta: string; saldo: number; data: string }[];
  topVencidos: {
    fornecedor: string; descricao: string | null; empresaCnpj: string | null; empresaNome: string; venc: string; dias: number; valor: number;
  }[];
  topClientesVencidos: {
    cliente: string; descricao: string | null; empresaCnpj: string | null; empresaNome: string; venc: string; dias: number; valor: number;
  }[];
  agingRecv: { a30: number; a60: number; a90: number; mais: number; total: number };
  clientesInadimplentes: {
    cliente: string;
    qtd: number;
    valor: number;
    diasMax: number;
    empresas: string[];
    aging: { a30: number; a60: number; a90: number; mais: number };
  }[];
  concentracao: {
    totais: { receber: number; pagar: number };
    receber: { nome: string; valor: number; pct: number; qtd: number }[];
    pagar: { nome: string; valor: number; pct: number; qtd: number }[];
    hhi: { receber: number; pagar: number }; // 0..10000 (Herfindahl)
    top5Pct: { receber: number; pagar: number };
  };
  deltas: {
    baseDate: string;
    saldoBancario: { abs: number; pct: number | null };
    aReceber: { abs: number; pct: number | null };
    aPagar: { abs: number; pct: number | null };
    vencidosValor: { abs: number; pct: number | null };
    vencidosCount: { abs: number; pct: number | null };
  } | null;
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
      fluxo: [], fluxoRealista: [],
      recuperacao: { exposicaoVencida: 0, recuperacaoEsperada: 0, perdaEsperada: 0, taxas: { a30: 0.9, a60: 0.6, a90: 0.3, mais: 0.1 } },
      empresas: [], bancos: [], saldos: [], topVencidos: [], topClientesVencidos: [],
      agingRecv: { a30: 0, a60: 0, a90: 0, mais: 0, total: 0 },
      clientesInadimplentes: [],
      concentracao: {
        totais: { receber: 0, pagar: 0 },
        receber: [], pagar: [],
        hhi: { receber: 0, pagar: 0 },
        top5Pct: { receber: 0, pagar: 0 },
      },
      deltas: null,
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

  // Fluxo projetado 180d — dois cenários:
  //  • Otimista: todo recebível vencido entra hoje pelo valor total.
  //  • Realista: recebíveis vencidos entram hoje aplicando taxa de recuperação
  //    por faixa de aging (quanto mais antigo, menor a chance de receber).
  // Em ambos, contas a pagar vencidas saem hoje (pior caso p/ o caixa).
  const RECOVERY = { a30: 0.9, a60: 0.6, a90: 0.3, mais: 0.1 };
  const overduePagarHoje = payVenc.reduce((s, r) => s + openAmount(r), 0);
  let overdueReceberOtimista = 0;
  let overdueReceberRealista = 0;
  recvVenc.forEach((r) => {
    const dias = Math.floor((today.getTime() - new Date(r.data_vencimento! + "T00:00:00").getTime()) / 86400000);
    const rate = dias <= 30 ? RECOVERY.a30 : dias <= 60 ? RECOVERY.a60 : dias <= 90 ? RECOVERY.a90 : RECOVERY.mais;
    const amt = openAmount(r);
    overdueReceberOtimista += amt;
    overdueReceberRealista += amt * rate;
  });

  const makeBuckets = () => {
    const b = new Map<string, { entrada: number; saida: number }>();
    for (let i = 0; i < 180; i++) {
      const d = new Date(today); d.setDate(d.getDate() + i);
      b.set(ymd(d), { entrada: 0, saida: 0 });
    }
    recv.filter((r) => r.data_vencimento! >= todayStr).forEach((r) => {
      const bk = b.get(r.data_vencimento!); if (bk) bk.entrada += openAmount(r);
    });
    pay.filter((r) => r.data_vencimento! >= todayStr).forEach((r) => {
      const bk = b.get(r.data_vencimento!); if (bk) bk.saida += openAmount(r);
    });
    return b;
  };

  const bucketsOtim = makeBuckets();
  const bucketsReal = makeBuckets();
  const todayBOtim = bucketsOtim.get(todayStr);
  const todayBReal = bucketsReal.get(todayStr);
  if (todayBOtim) { todayBOtim.entrada += overdueReceberOtimista; todayBOtim.saida += overduePagarHoje; }
  if (todayBReal) { todayBReal.entrada += overdueReceberRealista; todayBReal.saida += overduePagarHoje; }

  const buildFluxo = (buckets: Map<string, { entrada: number; saida: number }>) => {
    let s = saldoBancarioTotal;
    return Array.from(buckets.entries()).map(([d, v]) => {
      s += v.entrada - v.saida;
      const dt = new Date(d + "T00:00:00");
      return {
        dia: d,
        label: dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        entrada: v.entrada, saida: v.saida, saldo: s,
      };
    });
  };
  const fluxo = buildFluxo(bucketsOtim);
  const fluxoRealista = buildFluxo(bucketsReal);
  const recuperacao = {
    exposicaoVencida: overdueReceberOtimista,
    recuperacaoEsperada: overdueReceberRealista,
    perdaEsperada: overdueReceberOtimista - overdueReceberRealista,
    taxas: RECOVERY,
  };

  // Empresas — separa entrada (a receber) e saída (a pagar) por CNPJ.
  const empMap = new Map<string, { cnpj: string | null; nome: string; receber: number; pagar: number }>();
  [...recv, ...pay].forEach((r) => {
    const info = companyInfo(r.unidade_negocio);
    const key = `${info.cnpj || ""}|${info.nome}`;
    const cur = empMap.get(key) || { cnpj: info.cnpj, nome: info.nome, receber: 0, pagar: 0 };
    if (r.kind === "receivable") cur.receber += openAmount(r);
    else cur.pagar += openAmount(r);
    empMap.set(key, cur);
  });
  const empresasRaw = Array.from(empMap.values())
    .map((e) => ({ ...e, valor: e.receber - e.pagar }))
    .sort((a, b) => (Math.abs(b.receber) + Math.abs(b.pagar)) - (Math.abs(a.receber) + Math.abs(a.pagar)));
  const empMaxBar = Math.max(1, ...empresasRaw.map((e) => Math.max(e.receber, e.pagar)));
  const empresasWithPct = empresasRaw.map((e) => ({ ...e, pct: Math.round((Math.max(e.receber, e.pagar) / empMaxBar) * 100) }));

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
        fornecedor: (shortName(r.entidade) || "-").toUpperCase(),
        descricao: r.descricao?.trim() ? r.descricao.trim().toUpperCase() : null,
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
        cliente: (shortName(r.entidade) || "-").toUpperCase(),
        descricao: r.descricao?.trim() ? r.descricao.trim().toUpperCase() : null,
        empresaCnpj: info.cnpj,
        empresaNome: info.nome,
        venc: r.data_vencimento!,
        dias: Math.floor((today.getTime() - new Date(r.data_vencimento! + "T00:00:00").getTime()) / 86400000),
        valor: openAmount(r),
      };
    })
    .sort((a, b) => b.valor - a.valor);

  // Aging de recebíveis vencidos + agrupamento por cliente
  const agingRecv = { a30: 0, a60: 0, a90: 0, mais: 0, total: 0 };
  const clienteMap = new Map<string, {
    cliente: string; qtd: number; valor: number; diasMax: number;
    empresas: Set<string>; aging: { a30: number; a60: number; a90: number; mais: number };
  }>();
  topClientesVencidos.forEach((t) => {
    agingRecv.total += t.valor;
    let bucket: "a30" | "a60" | "a90" | "mais";
    if (t.dias <= 30) bucket = "a30";
    else if (t.dias <= 60) bucket = "a60";
    else if (t.dias <= 90) bucket = "a90";
    else bucket = "mais";
    agingRecv[bucket] += t.valor;
    const key = t.cliente.toLowerCase();
    const cur = clienteMap.get(key) || {
      cliente: t.cliente, qtd: 0, valor: 0, diasMax: 0,
      empresas: new Set<string>(),
      aging: { a30: 0, a60: 0, a90: 0, mais: 0 },
    };
    cur.qtd += 1;
    cur.valor += t.valor;
    cur.diasMax = Math.max(cur.diasMax, t.dias);
    cur.empresas.add(t.empresaNome);
    cur.aging[bucket] += t.valor;
    clienteMap.set(key, cur);
  });
  const clientesInadimplentes = Array.from(clienteMap.values())
    .map((c) => ({
      cliente: c.cliente, qtd: c.qtd, valor: c.valor, diasMax: c.diasMax,
      empresas: Array.from(c.empresas), aging: c.aging,
    }))
    .sort((a, b) => b.valor - a.valor);

  // Concentração de risco — agrega por entidade (cliente/fornecedor) do a receber e a pagar.
  const aggregateBy = (rowsIn: InvoiceRow[]) => {
    const m = new Map<string, { nome: string; valor: number; qtd: number }>();
    rowsIn.forEach((r) => {
      const nome = (shortName(r.entidade) || "—").toUpperCase();
      const key = nome.toLowerCase();
      const cur = m.get(key) || { nome, valor: 0, qtd: 0 };
      cur.valor += openAmount(r);
      cur.qtd += 1;
      m.set(key, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.valor - a.valor);
  };
  const aggRecv = aggregateBy(recv);
  const aggPay = aggregateBy(pay);
  const totalRecvConc = aggRecv.reduce((s, x) => s + x.valor, 0);
  const totalPayConc = aggPay.reduce((s, x) => s + x.valor, 0);
  const withPct = (arr: { nome: string; valor: number; qtd: number }[], total: number) =>
    arr.map((x) => ({ ...x, pct: total > 0 ? (x.valor / total) * 100 : 0 }));
  const receberConc = withPct(aggRecv, totalRecvConc).slice(0, 10);
  const pagarConc = withPct(aggPay, totalPayConc).slice(0, 10);
  const hhi = (arr: { valor: number }[], total: number) => {
    if (total <= 0) return 0;
    return Math.round(arr.reduce((s, x) => s + Math.pow((x.valor / total) * 100, 2), 0));
  };
  const top5Sum = (arr: { pct: number }[]) => arr.slice(0, 5).reduce((s, x) => s + x.pct, 0);
  const concentracao = {
    totais: { receber: totalRecvConc, pagar: totalPayConc },
    receber: receberConc,
    pagar: pagarConc,
    hhi: { receber: hhi(aggRecv, totalRecvConc), pagar: hhi(aggPay, totalPayConc) },
    top5Pct: { receber: top5Sum(withPct(aggRecv, totalRecvConc)), pagar: top5Sum(withPct(aggPay, totalPayConc)) },
  };

  // Snapshot diário (idempotente) + variação vs. snapshot mais próximo de ~30 dias atrás.
  const vencidosValor =
    recvVenc.reduce((s, r) => s + openAmount(r), 0) +
    payVenc.reduce((s, r) => s + openAmount(r), 0);
  const vencidosCount = recvVenc.length + payVenc.length;
  const deltas = await computeSnapshotAndDeltas({
    todayStr,
    saldoBancario: saldoBancarioTotal,
    aReceber: aReceberTotal,
    aPagar: aPagarTotal,
    vencidosValor,
    vencidosCount,
  });

  return {
    hasData: true,
    ultimaImportacao: ultima,
    saldoBancarioTotal,
    aReceberTotal, aReceberVencidosCount: recvVenc.length,
    aReceberVencidosValor: recvVenc.reduce((s, r) => s + openAmount(r), 0),
    aPagarTotal, aPagarVencidosCount: payVenc.length,
    aPagarVencidosValor: payVenc.reduce((s, r) => s + openAmount(r), 0),
    hoje, semana, fluxo, fluxoRealista, recuperacao,
    empresas: empresasWithPct, bancos: bancosWithPct, saldos, topVencidos, topClientesVencidos,
    agingRecv, clientesInadimplentes,
    concentracao,
    deltas,
  };
}

type SnapshotRow = {
  snapshot_date: string;
  saldo_bancario: number;
  a_receber: number;
  a_pagar: number;
  vencidos_valor: number;
  vencidos_count: number;
};

async function computeSnapshotAndDeltas(current: {
  todayStr: string;
  saldoBancario: number;
  aReceber: number;
  aPagar: number;
  vencidosValor: number;
  vencidosCount: number;
}): Promise<DashboardData["deltas"]> {
  const targetPrev = new Date(current.todayStr + "T00:00:00");
  targetPrev.setDate(targetPrev.getDate() - 30);
  const targetPrevStr = ymd(targetPrev);

  // Grava snapshot de hoje (ignora conflito de unicidade — 1 por dia).
  try {
    await supabase.from("dashboard_snapshots").insert({
      snapshot_date: current.todayStr,
      saldo_bancario: current.saldoBancario,
      a_receber: current.aReceber,
      a_pagar: current.aPagar,
      vencidos_valor: current.vencidosValor,
      vencidos_count: current.vencidosCount,
    });
  } catch {
    // silencioso: se falhar (conflito ou permissão), ainda seguimos com o cálculo do delta.
  }

  // Snapshot base: o mais recente com data <= (hoje - 30d). Se não houver,
  // pega o mais antigo disponível — assim já mostramos algum comparativo.
  const { data: prevRows } = await supabase
    .from("dashboard_snapshots")
    .select("snapshot_date,saldo_bancario,a_receber,a_pagar,vencidos_valor,vencidos_count")
    .lte("snapshot_date", targetPrevStr)
    .order("snapshot_date", { ascending: false })
    .limit(1);

  let base = (prevRows as SnapshotRow[] | null)?.[0];
  if (!base) {
    const { data: oldest } = await supabase
      .from("dashboard_snapshots")
      .select("snapshot_date,saldo_bancario,a_receber,a_pagar,vencidos_valor,vencidos_count")
      .lt("snapshot_date", current.todayStr)
      .order("snapshot_date", { ascending: true })
      .limit(1);
    base = (oldest as SnapshotRow[] | null)?.[0];
  }
  if (!base) return null;

  const diff = (cur: number, prev: number) => {
    const abs = cur - prev;
    const pct = prev === 0 ? null : (abs / Math.abs(prev)) * 100;
    return { abs, pct };
  };

  return {
    baseDate: base.snapshot_date,
    saldoBancario: diff(current.saldoBancario, Number(base.saldo_bancario) || 0),
    aReceber: diff(current.aReceber, Number(base.a_receber) || 0),
    aPagar: diff(current.aPagar, Number(base.a_pagar) || 0),
    vencidosValor: diff(current.vencidosValor, Number(base.vencidos_valor) || 0),
    vencidosCount: diff(current.vencidosCount, Number(base.vencidos_count) || 0),
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
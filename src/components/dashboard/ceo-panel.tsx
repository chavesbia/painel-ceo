import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  TrendingUp,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* MOCK DATA — substituído pelos CSVs quando a importação for ligada  */
/* ------------------------------------------------------------------ */

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const brlShort = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return brl(v);
};

const HERO = {
  saldo: 12_847_302.55,
  variacao7d: 2.3,
  cobertura: 62,
  menorSaldoValor: 3_240_500,
  menorSaldoData: "22/07/2026",
  ultimaImportacao: "30/06/2026 · 07:12",
};

const KPIS = {
  aReceber: { total: 4_120_000, vencidos: 12, vencidosValor: 285_400 },
  aPagar: { total: 3_560_000, vencidos: 8, vencidosValor: 142_800 },
  resultado: { valor: 560_000, entradas: 4_120_000, saidas: 3_560_000 },
};

const HOJE = { receber: 182_400, pagar: 96_200, vencidos: 2 };
const SEMANA = { receber: 890_500, pagar: 745_200, saldoFinal: 12_992_600 };

// Fluxo de caixa projetado — 30 dias
const fluxoCaixa = (() => {
  const base = HERO.saldo;
  const arr: { dia: string; saldo: number }[] = [];
  let atual = base;
  const delta = [
    120, -240, 80, -80, 210, -50, 30, -320, 120, -180,
    -60, -410, 320, 90, -220, -140, 380, 40, -260, -90,
    150, -70, -3_240, 420, 180, -120, 260, 60, -80, 210,
  ];
  for (let i = 0; i < 30; i++) {
    atual += delta[i] * 1000;
    const d = new Date(2026, 5, 30);
    d.setDate(d.getDate() + i);
    arr.push({
      dia: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      saldo: Math.round(atual),
    });
  }
  return arr;
})();

const menorSaldoPoint = fluxoCaixa.reduce((min, p) => (p.saldo < min.saldo ? p : min), fluxoCaixa[0]);

const EMPRESAS = [
  { nome: "Prevermed Centro Médico", saldo: 6_420_000, pct: 50 },
  { nome: "Centro Médico Diagnóstico", saldo: 3_147_000, pct: 24 },
  { nome: "Prevermed Odontologia", saldo: 2_040_300, pct: 16 },
  { nome: "Holding Administrativa", saldo: 1_240_002, pct: 10 },
];

const BANCOS = [
  { nome: "Banco do Brasil", pct: 55, cor: "var(--brand-deep)" },
  { nome: "Itaú Unibanco", pct: 28, cor: "var(--brand-blue)" },
  { nome: "Sicredi", pct: 12, cor: "oklch(0.70 0.15 200)" },
  { nome: "Santander", pct: 5, cor: "oklch(0.75 0.14 85)" },
];

const ALERTAS = [
  {
    tipo: "red" as const,
    titulo: "Saldo abaixo do mínimo previsto em 22/07",
    detalhe: "Menor saldo projetado: R$ 3,2M · queda concentrada em compromissos SUS",
  },
  {
    tipo: "yellow" as const,
    titulo: "Concentração alta no Banco do Brasil (55%)",
    detalhe: "Recomenda-se rebalancear caixa entre Itaú e Sicredi",
  },
  {
    tipo: "green" as const,
    titulo: "Recebimento extraordinário confirmado",
    detalhe: "Repasse Unimed R$ 420k programado para 05/07",
  },
];

const TOP_VENCIDOS = [
  { fornecedor: "Laboratório DASA S.A.", empresa: "Prevermed Centro Médico", venc: "12/06/2026", dias: 18, valor: 68_400 },
  { fornecedor: "Siemens Healthineers", empresa: "Centro Médico Diagnóstico", venc: "18/06/2026", dias: 12, valor: 54_200 },
  { fornecedor: "MedSupply Distribuidora", empresa: "Prevermed Centro Médico", venc: "20/06/2026", dias: 10, valor: 42_800 },
  { fornecedor: "Energisa Distribuição", empresa: "Holding Administrativa", venc: "22/06/2026", dias: 8, valor: 32_100 },
  { fornecedor: "Construtora Alfa Ltda", empresa: "Prevermed Odontologia", venc: "24/06/2026", dias: 6, valor: 28_500 },
];

/* ------------------------------------------------------------------ */
/* PANEL                                                              */
/* ------------------------------------------------------------------ */

export function CeoPanel() {
  return (
    <div className="p-6 md:p-8 space-y-8 max-w-[1440px] mx-auto">
      {/* HEADER */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold">
            Performance Consolidada
          </p>
          <h1 className="mt-1 text-3xl md:text-4xl font-display font-bold text-foreground tracking-tight">
            Painel do CEO
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fonte: ERP · última importação em {HERO.ultimaImportacao}
          </p>
        </div>
        <StatusPill state="green" label="Saudável" hint={`Cobertura ${HERO.cobertura} dias`} />
      </header>

      {/* FAIXA 1 — HERO */}
      <section className="grid grid-cols-12 gap-6">
        <Card className="col-span-12 lg:col-span-8">
          <div className="flex flex-col gap-4">
            <Label>Saldo Consolidado</Label>
            <div className="flex flex-wrap items-end gap-4">
              <h2 className="text-5xl md:text-6xl font-display font-bold tabular-nums tracking-tight text-foreground">
                {brl(HERO.saldo)}
              </h2>
              <div className="flex items-center gap-1 text-status-green text-sm font-semibold pb-2">
                <ArrowUpRight className="size-4" />
                +{HERO.variacao7d}% em 7 dias
              </div>
            </div>
            <MiniSparkline data={fluxoCaixa.slice(0, 14).map((d) => d.saldo)} />
          </div>
        </Card>

        <Card className="col-span-12 lg:col-span-4 bg-primary text-primary-foreground">
          <div className="flex flex-col justify-between h-full gap-6">
            <div>
              <Label className="text-primary-foreground/70">Menor saldo projetado (30d)</Label>
              <p className="mt-3 text-3xl font-display font-bold tabular-nums">
                {brlShort(HERO.menorSaldoValor)}
              </p>
              <p className="text-sm text-primary-foreground/75 mt-1">em {HERO.menorSaldoData}</p>
            </div>
            <div className="border-t border-white/15 pt-4">
              <Label className="text-primary-foreground/70">Cobertura operacional</Label>
              <p className="mt-2 text-2xl font-display font-semibold tabular-nums">
                {HERO.cobertura} <span className="text-sm font-normal opacity-70">dias</span>
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* FAIXA 2 — 3 KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard
          label="A Receber"
          value={brl(KPIS.aReceber.total)}
          hint={`${KPIS.aReceber.vencidos} títulos vencidos · ${brlShort(KPIS.aReceber.vencidosValor)}`}
          accent="green"
        />
        <KpiCard
          label="A Pagar"
          value={brl(KPIS.aPagar.total)}
          hint={`${KPIS.aPagar.vencidos} títulos vencidos · ${brlShort(KPIS.aPagar.vencidosValor)}`}
          accent="red"
        />
        <KpiCard
          label="Resultado Líquido Projetado 30d"
          value={`+${brl(KPIS.resultado.valor)}`}
          hint={`Entradas ${brlShort(KPIS.resultado.entradas)} · Saídas ${brlShort(KPIS.resultado.saidas)}`}
          accent="brand"
          extra={
            <div className="mt-4 flex items-end gap-2 h-10">
              <div className="flex-1 rounded-sm bg-status-green/25 border-t-2 border-status-green" style={{ height: "82%" }} />
              <div className="flex-1 rounded-sm bg-status-red/25 border-t-2 border-status-red" style={{ height: "68%" }} />
            </div>
          }
        />
      </section>

      {/* FAIXA 3 — HOJE / SEMANA */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <Label>Hoje · 30/06/2026</Label>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Movimentos previstos</span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-4">
            <MiniStat label="A Receber" value={brlShort(HOJE.receber)} color="green" />
            <MiniStat label="A Pagar" value={brlShort(HOJE.pagar)} color="red" />
            <MiniStat label="Vencidos hoje" value={String(HOJE.vencidos)} color="yellow" suffix="títulos" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <Label>Esta Semana</Label>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">30/06 → 06/07</span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-4">
            <MiniStat label="A Receber" value={brlShort(SEMANA.receber)} color="green" />
            <MiniStat label="A Pagar" value={brlShort(SEMANA.pagar)} color="red" />
            <MiniStat label="Saldo final estimado" value={brlShort(SEMANA.saldoFinal)} color="brand" />
          </div>
        </Card>
      </section>

      {/* FAIXA 4 — FLUXO DE CAIXA PROJETADO */}
      <section>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-display font-semibold">Fluxo de Caixa Projetado</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Saldo consolidado dia a dia · marcadores em menor saldo e primeiro dia negativo
              </p>
            </div>
            <div className="flex gap-1 p-1 rounded-md bg-muted">
              {["7d", "15d", "30d", "60d", "90d", "180d"].map((p) => (
                <button
                  key={p}
                  className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                    p === "30d" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={fluxoCaixa} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--brand-blue)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--brand-blue)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="dia"
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "var(--color-border)" }}
                  interval={4}
                />
                <YAxis
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `R$ ${(v / 1_000_000).toFixed(1)}M`}
                  width={70}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--color-muted-foreground)", fontWeight: 600 }}
                  formatter={(v: number) => [brl(v), "Saldo"]}
                />
                <ReferenceLine y={0} stroke="var(--status-red)" strokeDasharray="4 4" />
                <Area
                  type="monotone"
                  dataKey="saldo"
                  stroke="var(--brand-blue)"
                  strokeWidth={2}
                  fill="url(#areaFill)"
                />
                <ReferenceDot
                  x={menorSaldoPoint.dia}
                  y={menorSaldoPoint.saldo}
                  r={6}
                  fill="var(--status-yellow)"
                  stroke="var(--color-card)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      {/* FAIXA 5 — EMPRESAS / BANCOS / ALERTAS */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <Label>Saldo por Empresa</Label>
          <div className="mt-5 space-y-4">
            {EMPRESAS.map((e) => (
              <div key={e.nome}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium truncate">{e.nome}</span>
                  <span className="tabular-nums text-muted-foreground">{brlShort(e.saldo)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full" style={{ width: `${e.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <Label>Saldo por Banco</Label>
          <div className="mt-5 flex flex-col items-center">
            <Donut segments={BANCOS} />
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 w-full">
              {BANCOS.map((b) => (
                <div key={b.nome} className="flex items-center gap-2 text-xs">
                  <span className="size-2.5 rounded-sm" style={{ background: b.cor }} />
                  <span className="truncate text-muted-foreground">{b.nome}</span>
                  <span className="ml-auto tabular-nums font-medium">{b.pct}%</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <Label>Alertas</Label>
          <div className="mt-4 space-y-3">
            {ALERTAS.map((a, i) => (
              <AlertRow key={i} {...a} />
            ))}
          </div>
        </Card>
      </section>

      {/* TOP 5 VENCIDOS */}
      <section>
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <Label>Top 5 títulos vencidos</Label>
              <p className="text-xs text-muted-foreground mt-1">Priorize regularização por valor e dias em atraso</p>
            </div>
            <TrendingUp className="size-4 text-muted-foreground" />
          </div>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left font-semibold px-2 py-2">Fornecedor</th>
                  <th className="text-left font-semibold px-2 py-2">Empresa</th>
                  <th className="text-left font-semibold px-2 py-2">Vencimento</th>
                  <th className="text-right font-semibold px-2 py-2">Dias</th>
                  <th className="text-right font-semibold px-2 py-2">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {TOP_VENCIDOS.map((t, i) => (
                  <tr key={i} className="hover:bg-muted/50 transition-colors">
                    <td className="px-2 py-3 font-medium">{t.fornecedor}</td>
                    <td className="px-2 py-3 text-muted-foreground">{t.empresa}</td>
                    <td className="px-2 py-3 tabular-nums text-muted-foreground">{t.venc}</td>
                    <td className="px-2 py-3 text-right tabular-nums text-status-red font-semibold">{t.dias}</td>
                    <td className="px-2 py-3 text-right tabular-nums font-semibold">{brl(t.valor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <footer className="text-[11px] text-muted-foreground pt-2 pb-6 flex flex-wrap items-center gap-2">
        <Info className="size-3.5" />
        Dados exibidos são de demonstração até a primeira importação dos CSVs do ERP. Empresa CNPJ 37.260.594/0002-60 é excluída globalmente.
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PRIMITIVES                                                          */
/* ------------------------------------------------------------------ */

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`text-[10px] uppercase tracking-[0.2em] font-semibold text-muted-foreground ${className}`}>
      {children}
    </p>
  );
}

function StatusPill({ state, label, hint }: { state: "green" | "yellow" | "red"; label: string; hint: string }) {
  const cls = {
    green: "bg-status-green/10 text-status-green",
    yellow: "bg-status-yellow/10 text-status-yellow",
    red: "bg-status-red/10 text-status-red",
  }[state];
  const Icon = state === "green" ? CheckCircle2 : state === "yellow" ? AlertTriangle : AlertTriangle;
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2 shadow-sm">
      <div className="flex flex-col items-end">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Semáforo</span>
        <span className={`text-xs font-bold flex items-center gap-1.5 ${cls.split(" ")[1]}`}>
          <span className={`size-2 rounded-full ${cls.split(" ")[0]}`} />
          {label.toUpperCase()}
        </span>
      </div>
      <div className="border-l border-border pl-3 flex items-center gap-2">
        <Icon className={`size-4 ${cls.split(" ")[1]}`} />
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  accent,
  extra,
}: {
  label: string;
  value: string;
  hint: string;
  accent: "green" | "red" | "brand";
  extra?: React.ReactNode;
}) {
  const bar = {
    green: "bg-status-green",
    red: "bg-status-red",
    brand: "bg-accent",
  }[accent];
  return (
    <Card>
      <div className={`h-0.5 w-8 rounded-full ${bar} mb-4`} />
      <Label>{label}</Label>
      <p className="mt-3 text-3xl font-display font-bold tabular-nums tracking-tight">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      {extra}
    </Card>
  );
}

function MiniStat({
  label,
  value,
  color,
  suffix,
}: {
  label: string;
  value: string;
  color: "green" | "red" | "yellow" | "brand";
  suffix?: string;
}) {
  const cls = {
    green: "text-status-green",
    red: "text-status-red",
    yellow: "text-status-yellow",
    brand: "text-accent",
  }[color];
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className={`mt-1.5 text-xl font-display font-semibold tabular-nums ${cls}`}>
        {value} {suffix && <span className="text-xs text-muted-foreground font-normal">{suffix}</span>}
      </p>
    </div>
  );
}

function MiniSparkline({ data }: { data: number[] }) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 100;
      const y = 100 - ((v - min) / range) * 100;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-10 opacity-80">
      <polyline
        fill="none"
        stroke="var(--brand-blue)"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        points={pts}
      />
    </svg>
  );
}

function Donut({ segments }: { segments: { pct: number; cor: string }[] }) {
  const size = 128;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-muted)" strokeWidth={stroke} />
        {segments.map((s, i) => {
          const len = (s.pct / 100) * c;
          const dash = `${len} ${c - len}`;
          const offset = c * (1 - acc / 100);
          acc += s.pct;
          return (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.cor}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Bancos</span>
        <span className="text-lg font-display font-bold">{segments.length}</span>
      </div>
    </div>
  );
}

function AlertRow({ tipo, titulo, detalhe }: { tipo: "green" | "yellow" | "red"; titulo: string; detalhe: string }) {
  const border = {
    green: "border-l-status-green",
    yellow: "border-l-status-yellow",
    red: "border-l-status-red",
  }[tipo];
  const bg = {
    green: "bg-status-green/5",
    yellow: "bg-status-yellow/5",
    red: "bg-status-red/5",
  }[tipo];
  const Icon = tipo === "green" ? CheckCircle2 : tipo === "yellow" ? AlertTriangle : ArrowDownRight;
  const iconCls = {
    green: "text-status-green",
    yellow: "text-status-yellow",
    red: "text-status-red",
  }[tipo];
  return (
    <div className={`border-l-2 ${border} ${bg} rounded-r-md p-3 flex gap-3 items-start`}>
      <Icon className={`size-4 shrink-0 mt-0.5 ${iconCls}`} />
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-tight">{titulo}</p>
        <p className="text-[11px] text-muted-foreground leading-snug mt-1">{detalhe}</p>
      </div>
    </div>
  );
}
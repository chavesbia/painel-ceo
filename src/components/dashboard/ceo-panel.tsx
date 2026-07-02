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
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { loadDashboard, type DashboardData } from "@/lib/dashboard";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const brlShort = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return brl(v);
};

const BANK_COLORS = [
  "var(--brand-deep)",
  "var(--brand-blue)",
  "oklch(0.70 0.15 200)",
  "oklch(0.75 0.14 85)",
  "oklch(0.65 0.15 25)",
];

/* ------------------------------------------------------------------ */
/* PANEL                                                              */
/* ------------------------------------------------------------------ */

export function CeoPanel() {
  const { data, error } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: loadDashboard,
    refetchOnWindowFocus: true,
  });

  if (error) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="rounded-lg border border-status-red/30 bg-status-red/5 p-4 text-sm text-status-red">
          Falha ao carregar dashboard: {error instanceof Error ? error.message : String(error)}
        </div>
      </div>
    );
  }
  if (!data) return <div className="p-8 text-sm text-muted-foreground">Carregando painel…</div>;

  if (!data.hasData) return <EmptyState ultima={data.ultimaImportacao} />;

  const resultado = data.aReceberTotal - data.aPagarTotal;
  const saldoAtual = data.saldoBancarioTotal;
  const fluxoChart = data.fluxo.map((f) => ({ dia: f.label, saldo: f.saldo }));
  const menorSaldoPoint = fluxoChart.length
    ? fluxoChart.reduce((min, p) => (p.saldo < min.saldo ? p : min), fluxoChart[0])
    : { dia: "", saldo: 0 };
  const bancos = data.bancos.map((b, i) => ({ ...b, cor: BANK_COLORS[i % BANK_COLORS.length] }));

  const alertas: { tipo: "green" | "yellow" | "red"; titulo: string; detalhe: string }[] = [];
  if (data.aPagarVencidosCount > 0) {
    alertas.push({
      tipo: "red",
      titulo: `${data.aPagarVencidosCount} títulos a pagar vencidos`,
      detalhe: `Total em aberto: ${brl(data.aPagarVencidosValor)}`,
    });
  }
  if (data.aReceberVencidosCount > 0) {
    alertas.push({
      tipo: "yellow",
      titulo: `${data.aReceberVencidosCount} recebimentos em atraso`,
      detalhe: `Total a cobrar: ${brl(data.aReceberVencidosValor)}`,
    });
  }
  if (resultado > 0) {
    alertas.push({
      tipo: "green",
      titulo: "Resultado projetado positivo nos próximos 30 dias",
      detalhe: `Superávit de ${brl(resultado)} previsto`,
    });
  } else if (resultado < 0) {
    alertas.push({
      tipo: "red",
      titulo: "Resultado projetado negativo nos próximos 30 dias",
      detalhe: `Déficit projetado de ${brl(Math.abs(resultado))}`,
    });
  }

  const semaforoState: "green" | "yellow" | "red" =
    resultado < 0 || data.aPagarVencidosCount > 5 ? "red"
    : data.aReceberVencidosCount > 0 || data.aPagarVencidosCount > 0 ? "yellow" : "green";
  const semaforoLabel = semaforoState === "green" ? "Saudável" : semaforoState === "yellow" ? "Atenção" : "Crítico";

  const ultimaFmt = data.ultimaImportacao
    ? new Date(data.ultimaImportacao).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "—";

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-[1440px] mx-auto">
      {/* HEADER */}
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold">
            Visão Consolidada
          </p>
          <h1 className="mt-1 text-3xl md:text-4xl font-display font-bold text-foreground tracking-tight">
            Painel do CEO
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fonte: ERP · última importação em {ultimaFmt}
          </p>
        </div>
        <StatusPill state={semaforoState} label={semaforoLabel} hint={`Resultado 30d ${brlShort(resultado)}`} />
      </header>

      {/* FAIXA 1 — HERO */}
      <section className="grid grid-cols-12 gap-6">
        <Card className="col-span-12 lg:col-span-8">
          <div className="flex flex-col gap-4">
            <Label>Resultado de Faturas 30 dias</Label>
            <div className="flex flex-wrap items-end gap-4">
              <h2 className="text-5xl md:text-6xl font-display font-bold tabular-nums tracking-tight text-foreground">
                {resultado >= 0 ? "+" : ""}{brl(resultado)}
              </h2>
              <div className={`flex items-center gap-1 text-sm font-semibold pb-2 ${resultado >= 0 ? "text-status-green" : "text-status-red"}`}>
                {resultado >= 0 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}
                Entradas {brlShort(data.aReceberTotal)} · Saídas {brlShort(data.aPagarTotal)}
              </div>
            </div>
            {fluxoChart.length > 0 && (
              <MiniSparkline data={fluxoChart.slice(0, 14).map((d) => d.saldo)} />
            )}
          </div>
        </Card>

        <Card className="col-span-12 lg:col-span-4 bg-primary text-primary-foreground">
          <div className="flex flex-col justify-between h-full gap-6">
            <div>
              <Label className="text-primary-foreground/70">Menor saldo projetado (30d)</Label>
              <p className="mt-3 text-3xl font-display font-bold tabular-nums">
                {brlShort(menorSaldoPoint.saldo)}
              </p>
              <p className="text-sm text-primary-foreground/75 mt-1">em {menorSaldoPoint.dia || "—"}</p>
            </div>
            <div className="border-t border-white/15 pt-4">
              <Label className="text-primary-foreground/70">Saldo bancário inicial</Label>
              <p className="mt-2 text-xl font-display font-semibold tabular-nums">
                {brl(saldoAtual)}
                <span className="ml-2 text-[10px] font-normal opacity-70 uppercase tracking-wider">Saldos cadastrados</span>
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* FAIXA 2 — 3 KPIs */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard
          label="A Receber"
          value={brl(data.aReceberTotal)}
          hint={`${data.aReceberVencidosCount} títulos vencidos · ${brlShort(data.aReceberVencidosValor)}`}
          accent="green"
        />
        <KpiCard
          label="A Pagar"
          value={brl(data.aPagarTotal)}
          hint={`${data.aPagarVencidosCount} títulos vencidos · ${brlShort(data.aPagarVencidosValor)}`}
          accent="red"
        />
        <KpiCard
          label="Resultado Líquido Projetado 30d"
          value={`${resultado >= 0 ? "+" : ""}${brl(resultado)}`}
          hint={`Entradas ${brlShort(data.aReceberTotal)} · Saídas ${brlShort(data.aPagarTotal)}`}
          accent="brand"
        />
      </section>

      {/* FAIXA 3 — HOJE / SEMANA */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <div className="flex items-center justify-between">
            <Label>Hoje · {new Date().toLocaleDateString("pt-BR")}</Label>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Movimentos previstos</span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-4">
            <MiniStat label="A Receber" value={brlShort(data.hoje.receber)} color="green" />
            <MiniStat label="A Pagar" value={brlShort(data.hoje.pagar)} color="red" />
            <MiniStat label="Vencidos" value={String(data.hoje.vencidos)} color="yellow" suffix="títulos" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <Label>Esta Semana</Label>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">7 dias</span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-4">
            <MiniStat label="A Receber" value={brlShort(data.semana.receber)} color="green" />
            <MiniStat label="A Pagar" value={brlShort(data.semana.pagar)} color="red" />
            <MiniStat label="Resultado" value={brlShort(data.semana.receber - data.semana.pagar)} color="brand" />
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
                Saldo acumulado por vencimento (30 dias) · saldo bancário inicial incluso
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
              <AreaChart data={fluxoChart} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
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
                  tickFormatter={(v) => brlShort(v)}
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
                {menorSaldoPoint.dia && (
                  <ReferenceDot
                    x={menorSaldoPoint.dia}
                    y={menorSaldoPoint.saldo}
                    r={6}
                    fill="var(--status-yellow)"
                    stroke="var(--color-card)"
                    strokeWidth={2}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </section>

      {/* FAIXA 5 — EMPRESAS / BANCOS / ALERTAS */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <Label>Exposição por Empresa (líquido)</Label>
          <div className="mt-5 space-y-4">
            {data.empresas.length === 0 && <p className="text-xs text-muted-foreground">Sem dados</p>}
            {data.empresas.map((e) => (
              <div key={`${e.cnpj || ""}-${e.nome}`}>
                <div className="flex justify-between text-sm mb-1.5">
                  <div className="min-w-0">
                    {e.cnpj && <div className="tabular-nums text-xs text-muted-foreground">{e.cnpj}</div>}
                    <div className="font-medium truncate">{e.nome}</div>
                  </div>
                  <span className={`tabular-nums ${e.valor >= 0 ? "text-status-green" : "text-status-red"}`}>{brlShort(e.valor)}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${e.valor >= 0 ? "bg-accent" : "bg-status-red"}`} style={{ width: `${e.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <Label>Saldos por Conta Bancária</Label>
          <div className="mt-5 space-y-3">
            {data.saldos.length === 0 && <p className="text-xs text-muted-foreground">Sem saldos cadastrados</p>}
            {data.saldos.slice(0, 5).map((saldo) => (
              <div key={`${saldo.empresaNome}-${saldo.conta}`} className="rounded-md border border-border bg-muted/25 px-3 py-2.5">
                <div className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{saldo.conta}</p>
                    {saldo.empresaCnpj && (
                      <p className="text-[11px] text-muted-foreground tabular-nums mt-0.5">{saldo.empresaCnpj}</p>
                    )}
                    <p className="text-xs text-muted-foreground truncate">{saldo.empresaNome} · {new Date(saldo.data + "T00:00:00").toLocaleDateString("pt-BR")}</p>
                  </div>
                  <p className={`tabular-nums font-semibold ${saldo.saldo >= 0 ? "text-status-green" : "text-status-red"}`}>{brlShort(saldo.saldo)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <Label>Alertas</Label>
          <div className="mt-4 space-y-3">
            {alertas.length === 0 && <p className="text-xs text-muted-foreground">Nenhum alerta ativo.</p>}
            {alertas.map((a, i) => <AlertRow key={i} {...a} />)}
          </div>
        </Card>
      </section>

      {/* TOP 5 VENCIDOS */}
      <section>
        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <Label>Top 5 contas a pagar em atraso</Label>
              <p className="text-xs text-muted-foreground mt-1">Boletos/faturas já vencidos, ordenados pelo maior valor em aberto — priorize a regularização</p>
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
                {data.topVencidos.length === 0 && (
                  <tr><td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">Nenhum título vencido 🎉</td></tr>
                )}
                {data.topVencidos.map((t, i) => (
                  <tr key={i} className="hover:bg-muted/50 transition-colors">
                    <td className="px-2 py-3 font-medium">{t.fornecedor}</td>
                    <td className="px-2 py-3 text-muted-foreground">
                      {t.empresaCnpj && <div className="text-[11px] tabular-nums">{t.empresaCnpj}</div>}
                      <div>{t.empresaNome}</div>
                    </td>
                    <td className="px-2 py-3 tabular-nums text-muted-foreground">{new Date(t.venc + "T00:00:00").toLocaleDateString("pt-BR")}</td>
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
        Empresa CNPJ 37.260.594/0002-60 é excluída globalmente. O fluxo considera os saldos bancários cadastrados.
      </footer>
    </div>
  );
}

function EmptyState({ ultima }: { ultima: string | null }) {
  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
        <div className="mx-auto size-14 rounded-full bg-accent/10 text-accent flex items-center justify-center">
          <Info className="size-6" />
        </div>
        <h2 className="mt-4 text-xl font-display font-semibold">Sem dados importados</h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
          O painel será populado automaticamente assim que você importar os CSVs de Faturas a Pagar e Faturas a Receber exportados do ERP.
        </p>
        <Link
          to="/importacoes"
          className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          Ir para Importações
        </Link>
        {ultima && (
          <p className="mt-4 text-xs text-muted-foreground">Última tentativa: {new Date(ultima).toLocaleString("pt-BR")}</p>
        )}
      </div>
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
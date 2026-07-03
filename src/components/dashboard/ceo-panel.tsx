import * as React from "react";
import {
  ArrowDownRight,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  CheckCircle2,
  Info,
  TrendingUp,
  Printer,
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
  const [fluxoPeriodo, setFluxoPeriodo] = React.useState<7 | 15 | 30 | 60 | 90 | 180>(30);
  const [fluxoCenario, setFluxoCenario] = React.useState<"otimista" | "realista">("realista");
  const [pagarSort, setPagarSort] = React.useState<"valor" | "dias">("valor");
  const [clientesSort, setClientesSort] = React.useState<"valor" | "dias">("valor");
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
  const fluxoSerie = fluxoCenario === "realista" ? data.fluxoRealista : data.fluxo;
  const fluxoChart = fluxoSerie
    .slice(0, fluxoPeriodo)
    .map((f) => ({ dia: f.label, saldo: f.saldo, entrada: f.entrada, saida: f.saida }));
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
      {/* Cabeçalho de impressão (visível apenas ao imprimir/exportar PDF) */}
      <div className="hidden print:block print:mb-6">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold">PreverMed · Grupo Consolidado</p>
            <h1 className="text-2xl font-display font-bold">Painel do CEO — Relatório Financeiro</h1>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <p>Gerado em {new Date().toLocaleString("pt-BR")}</p>
            <p>Última importação: {ultimaFmt}</p>
          </div>
        </div>
      </div>
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
        <button
          type="button"
          onClick={() => window.print()}
          className="print:hidden inline-flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
          title="Imprimir ou salvar em PDF"
        >
          <Printer className="size-4" />
          Exportar / Imprimir
        </button>
      </header>

      {/* FAIXA 1 — HERO */}
      <section className="grid grid-cols-12 gap-6">
        <Card className="col-span-12 lg:col-span-8">
          <div className="flex flex-col gap-4">
            <Label>Resultado de Faturas 30 dias</Label>
            <div className="flex flex-wrap items-end gap-4">
              <h2 className="text-4xl md:text-5xl font-display font-bold tabular-nums tracking-tight text-accent">
                {resultado >= 0 ? "+" : ""}{brl(resultado)}
              </h2>
              <div className="flex items-center gap-3 text-sm font-semibold pb-2">
                <span className="inline-flex items-center gap-1 text-status-green">
                  <ArrowUp className="size-4" />
                  Entradas {brlShort(data.aReceberTotal)}
                </span>
                <span className="text-muted-foreground">·</span>
                <span className="inline-flex items-center gap-1 text-status-red">
                  <ArrowDown className="size-4" />
                  Saídas {brlShort(data.aPagarTotal)}
                </span>
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
              <p className="mt-3 text-2xl font-display font-bold tabular-nums">
                {brlShort(menorSaldoPoint.saldo)}
              </p>
              <p className="text-sm text-primary-foreground/75 mt-1">em {menorSaldoPoint.dia || "—"}</p>
            </div>
            <div className="border-t border-white/15 pt-4">
              <Label className="text-primary-foreground/70">Saldo bancário inicial</Label>
              <p className="mt-2 text-lg font-display font-semibold tabular-nums">
                {brl(saldoAtual)}
                <span className="ml-2 text-[10px] font-normal opacity-70 uppercase tracking-wider">Saldos cadastrados</span>
              </p>
              {data.deltas && (
                <DeltaChip
                  abs={data.deltas.saldoBancario.abs}
                  pct={data.deltas.saldoBancario.pct}
                  baseDate={data.deltas.baseDate}
                  goodWhen="up"
                  onDark
                />
              )}
            </div>
          </div>
        </Card>
      </section>

      {/* FAIXA 2 — KPIs principais */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KpiCard
          label="A Receber"
          value={brl(data.aReceberTotal)}
          hint="Total em aberto, somando todos os vencimentos (passados e futuros)."
          accent="green"
          direction="up"
          delta={data.deltas ? { ...data.deltas.aReceber, baseDate: data.deltas.baseDate, goodWhen: "up" } : null}
        />
        <KpiCard
          label="A Pagar"
          value={brl(data.aPagarTotal)}
          hint="Total em aberto, somando todos os vencimentos (passados e futuros)."
          accent="red"
          direction="down"
          delta={data.deltas ? { ...data.deltas.aPagar, baseDate: data.deltas.baseDate, goodWhen: "down" } : null}
        />
        <KpiCard
          label="Vencidos (a receber + a pagar)"
          value={brl(data.aReceberVencidosValor + data.aPagarVencidosValor)}
          hint={`${data.aReceberVencidosCount + data.aPagarVencidosCount} títulos vencidos no total.`}
          accent="red"
          delta={data.deltas ? { ...data.deltas.vencidosValor, baseDate: data.deltas.baseDate, goodWhen: "down" } : null}
        />
        <KpiCard
          label="Resultado Líquido Projetado 30d"
          value={`${resultado >= 0 ? "+" : ""}${brl(resultado)}`}
          hint={`↑ Entradas ${brlShort(data.aReceberTotal)}  ·  ↓ Saídas ${brlShort(data.aPagarTotal)}`}
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
          <div className="mt-5 grid grid-cols-2 gap-4">
            <MiniStat label="A Receber" value={brlShort(data.hoje.receber)} color="green" direction="up" />
            <MiniStat label="A Pagar" value={brlShort(data.hoje.pagar)} color="red" direction="down" />
          </div>
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <Label>Esta Semana</Label>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">7 dias</span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-4">
            <MiniStat label="A Receber" value={brlShort(data.semana.receber)} color="green" direction="up" />
            <MiniStat label="A Pagar" value={brlShort(data.semana.pagar)} color="red" direction="down" />
            <MiniStat label="Resultado" value={brlShort(data.semana.receber - data.semana.pagar)} color="brand" />
          </div>
        </Card>
      </section>

      {/* FAIXA 4 — SALDOS / ALERTAS (acima do fluxo) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Label>Saldos por Conta Bancária</Label>
          <div className="mt-5 space-y-3">
            {data.saldos.length === 0 && <p className="text-xs text-muted-foreground">Sem saldos cadastrados</p>}
            {data.saldos.slice(0, 5).map((saldo) => (
              <div key={`${saldo.empresaNome}-${saldo.conta}`} className="rounded-md border border-border bg-muted/25 px-3 py-2.5">
                <div className="flex items-start justify-between gap-3 text-[13px]">
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

      {/* FAIXA 5 — FLUXO DE CAIXA PROJETADO */}
      <section>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-display font-semibold">Fluxo de Caixa Projetado</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Saldo acumulado dia a dia: saldo bancário atual + recebimentos previstos − pagamentos previstos ({fluxoPeriodo} dias). Toque nos pontos para ver a data e o valor.
              </p>
            </div>
            <div className="flex flex-wrap gap-1 p-1 rounded-md bg-muted print:hidden">
              {([7, 15, 30, 60, 90, 180] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setFluxoPeriodo(p)}
                  className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
                    p === fluxoPeriodo ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p}d
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6 h-72 w-full">
            <CashFlowChart data={fluxoChart} minPoint={menorSaldoPoint} />
          </div>
        </Card>
      </section>

      {/* FAIXA 6 — POSIÇÃO POR EMPRESA (horizontal, abaixo do fluxo) */}
      <section>
        <Card>
          <Label>Posição por Empresa (a receber × a pagar)</Label>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Compara, por CNPJ, o total em aberto a receber e a pagar. Resultado = Receber − Pagar (verde = sobra, vermelho = falta).
          </p>
          {data.empresas.length === 0 && (
            <p className="mt-5 text-xs text-muted-foreground">Sem dados</p>
          )}
          {data.empresas.length > 0 && (
            <div
              className="mt-5 flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 lg:grid lg:grid-cols-5 lg:overflow-visible lg:snap-none print:grid print:grid-cols-5"
            >
              {data.empresas.map((e) => {
              const max = Math.max(e.receber, e.pagar, 1);
              const rPct = (e.receber / max) * 100;
              const pPct = (e.pagar / max) * 100;
              return (
                <div
                  key={`${e.cnpj || ""}-${e.nome}`}
                  className="shrink-0 basis-[260px] snap-start space-y-2 rounded-md border border-border bg-muted/20 p-3 lg:basis-auto lg:shrink"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-[13px] truncate">{e.nome}</div>
                    {e.cnpj && <div className="tabular-nums text-[11px] text-muted-foreground">{e.cnpj}</div>}
                  </div>

                  <div className="space-y-1.5">
                    <div>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className="text-muted-foreground">Entrada (a receber)</span>
                        <span className="tabular-nums text-status-green">{brlShort(e.receber)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-status-green" style={{ width: `${rPct}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className="text-muted-foreground">Saída (a pagar)</span>
                        <span className="tabular-nums text-status-red">{brlShort(e.pagar)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-status-red" style={{ width: `${pPct}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className={`flex justify-between items-center text-xs pt-1.5 border-t border-border/60`}>
                    <span className="text-muted-foreground">Resultado</span>
                    <span className={`tabular-nums font-semibold ${e.valor >= 0 ? "text-status-green" : "text-status-red"}`}>
                      {e.valor >= 0 ? "+" : ""}{brlShort(e.valor)}
                    </span>
                  </div>
                </div>
              );
              })}
            </div>
          )}
          {data.empresas.length > 5 && (
            <p className="mt-2 text-[11px] text-muted-foreground lg:hidden">
              Deslize para o lado para ver as demais empresas →
            </p>
          )}
        </Card>
      </section>

      {/* TOP 5 VENCIDOS */}
      <section>
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <Label>Top 5 contas a pagar em atraso</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Boletos/faturas já vencidos, ordenados por {pagarSort === "valor" ? "valor (maior → menor)" : "dias em atraso (mais antigos primeiro)"} — priorize a regularização
              </p>
            </div>
            <SortToggle value={pagarSort} onChange={setPagarSort} />
          </div>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left font-semibold px-2 py-2">Fornecedor</th>
                  <th className="text-left font-semibold px-2 py-2">Descrição</th>
                  <th className="text-left font-semibold px-2 py-2">Empresa</th>
                  <th className="text-left font-semibold px-2 py-2">Vencimento</th>
                  <th className="text-right font-semibold px-2 py-2">Dias</th>
                  <th className="text-right font-semibold px-2 py-2">Valor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.topVencidos.length === 0 && (
                  <tr><td colSpan={6} className="px-2 py-6 text-center text-muted-foreground">Nenhum título vencido 🎉</td></tr>
                )}
                {[...data.topVencidos]
                  .sort((a, b) => (pagarSort === "valor" ? b.valor - a.valor : b.dias - a.dias))
                  .slice(0, 5)
                  .map((t, i) => (
                  <tr key={i} className="hover:bg-muted/50 transition-colors">
                    <td className="px-2 py-3 font-medium">{t.fornecedor}</td>
                    <td className="px-2 py-3 text-muted-foreground max-w-[280px]">
                      <div className="truncate" title={t.descricao || ""}>{t.descricao || "—"}</div>
                    </td>
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

      {/* TOP 5 CLIENTES EM ATRASO */}
      <section>
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div className="min-w-0">
              <Label>Inadimplência de Clientes</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Recebíveis vencidos agrupados por cliente. Quanto mais dias em atraso, menor a chance de receber sem negociação — priorize contato nos blocos vermelhos.
              </p>
            </div>
            <SortToggle value={clientesSort} onChange={setClientesSort} />
          </div>

          {/* Aging summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <AgingBucket label="1 a 30 dias" valor={data.agingRecv.a30} total={data.agingRecv.total} tone="yellow" hint="Cobrança amigável" />
            <AgingBucket label="31 a 60 dias" valor={data.agingRecv.a60} total={data.agingRecv.total} tone="orange" hint="Atenção" />
            <AgingBucket label="61 a 90 dias" valor={data.agingRecv.a90} total={data.agingRecv.total} tone="red" hint="Risco elevado" />
            <AgingBucket label="Mais de 90 dias" valor={data.agingRecv.mais} total={data.agingRecv.total} tone="darkred" hint="Provável perda / renegociar" />
          </div>

          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left font-semibold px-2 py-2">Cliente</th>
                  <th className="text-left font-semibold px-2 py-2">Empresa(s)</th>
                  <th className="text-right font-semibold px-2 py-2">Títulos</th>
                  <th className="text-right font-semibold px-2 py-2">+ Antigo</th>
                  <th className="text-left font-semibold px-2 py-2 min-w-[200px]">Aging</th>
                  <th className="text-right font-semibold px-2 py-2">Total vencido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.clientesInadimplentes.length === 0 && (
                  <tr><td colSpan={6} className="px-2 py-6 text-center text-muted-foreground">Nenhum recebível vencido 🎉</td></tr>
                )}
                {[...data.clientesInadimplentes]
                  .sort((a, b) => (clientesSort === "valor" ? b.valor - a.valor : b.diasMax - a.diasMax))
                  .slice(0, 5)
                  .map((c, i) => (
                  <tr key={i} className="hover:bg-muted/50 transition-colors">
                    <td className="px-2 py-3 font-medium">{c.cliente}</td>
                    <td className="px-2 py-3 text-muted-foreground text-[11px]">
                      {c.empresas.join(" · ")}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums text-muted-foreground">{c.qtd}</td>
                    <td className="px-2 py-3 text-right tabular-nums font-semibold text-status-red">{c.diasMax}d</td>
                    <td className="px-2 py-3"><AgingBar aging={c.aging} total={c.valor} /></td>
                    <td className="px-2 py-3 text-right tabular-nums font-semibold text-status-green">{brl(c.valor)}</td>
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

function AgingBucket({
  label, valor, total, tone, hint,
}: {
  label: string; valor: number; total: number;
  tone: "yellow" | "orange" | "red" | "darkred"; hint: string;
}) {
  const pct = total > 0 ? Math.round((valor / total) * 100) : 0;
  const bg = {
    yellow: "bg-status-yellow",
    orange: "bg-orange-500",
    red: "bg-status-red",
    darkred: "bg-red-800",
  }[tone];
  const text = {
    yellow: "text-status-yellow",
    orange: "text-orange-600",
    red: "text-status-red",
    darkred: "text-red-800",
  }[tone];
  return (
    <div className="rounded-md border border-border bg-muted/25 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className={`mt-1.5 text-lg font-display font-bold tabular-nums ${text}`}>{brlShort(valor)}</p>
      <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full ${bg}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{hint}</span><span className="tabular-nums">{pct}%</span>
      </p>
    </div>
  );
}

function AgingBar({ aging, total }: { aging: { a30: number; a60: number; a90: number; mais: number }; total: number }) {
  if (total <= 0) return <div className="h-2 bg-muted rounded-full" />;
  const seg = (v: number) => `${(v / total) * 100}%`;
  return (
    <div className="flex h-2 w-full rounded-full overflow-hidden bg-muted" title={`≤30d ${brlShort(aging.a30)} · 31-60d ${brlShort(aging.a60)} · 61-90d ${brlShort(aging.a90)} · +90d ${brlShort(aging.mais)}`}>
      {aging.a30 > 0 && <div className="bg-status-yellow" style={{ width: seg(aging.a30) }} />}
      {aging.a60 > 0 && <div className="bg-orange-500" style={{ width: seg(aging.a60) }} />}
      {aging.a90 > 0 && <div className="bg-status-red" style={{ width: seg(aging.a90) }} />}
      {aging.mais > 0 && <div className="bg-red-800" style={{ width: seg(aging.mais) }} />}
    </div>
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
  direction,
  delta,
}: {
  label: string;
  value: string;
  hint: string;
  accent: "green" | "red" | "brand";
  extra?: React.ReactNode;
  direction?: "up" | "down";
  delta?: { abs: number; pct: number | null; baseDate: string; goodWhen: "up" | "down" } | null;
}) {
  const bar = {
    green: "bg-status-green",
    red: "bg-status-red",
    brand: "bg-accent",
  }[accent];
  const valueCls = {
    green: "text-status-green",
    red: "text-status-red",
    brand: "text-accent",
  }[accent];
  return (
    <Card>
      <div className={`h-0.5 w-8 rounded-full ${bar} mb-4`} />
      <Label>{label}</Label>
      <p className={`mt-3 text-2xl font-display font-bold tabular-nums tracking-tight flex items-center gap-1.5 whitespace-nowrap ${valueCls}`}>
        {direction === "up" && <ArrowUp className="size-5 shrink-0" />}
        {direction === "down" && <ArrowDown className="size-5 shrink-0" />}
        <span className="truncate">{value}</span>
      </p>
      {delta && (
        <div className="mt-1.5">
          <DeltaChip abs={delta.abs} pct={delta.pct} baseDate={delta.baseDate} goodWhen={delta.goodWhen} />
        </div>
      )}
      <p className="mt-2 text-xs text-muted-foreground">{hint}</p>
      {extra}
    </Card>
  );
}

function DeltaChip({
  abs,
  pct,
  baseDate,
  goodWhen,
  onDark,
}: {
  abs: number;
  pct: number | null;
  baseDate: string;
  goodWhen: "up" | "down";
  onDark?: boolean;
}) {
  const isZero = Math.abs(abs) < 0.005;
  const isUp = abs > 0;
  const good = isZero ? true : (goodWhen === "up" ? isUp : !isUp);
  const cls = isZero
    ? (onDark ? "text-primary-foreground/70" : "text-muted-foreground")
    : good
      ? "text-status-green"
      : "text-status-red";
  const Icon = isZero ? null : isUp ? ArrowUp : ArrowDown;
  const pctTxt = pct == null ? "—" : `${pct > 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")}%`;
  const baseFmt = new Date(baseDate + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums ${cls}`}
      title={`Comparado ao snapshot de ${baseFmt} — variação absoluta ${brl(abs)}`}
    >
      {Icon && <Icon className="size-3" />}
      <span>{pctTxt}</span>
      <span className={`font-normal ${onDark ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
        vs. {baseFmt}
      </span>
    </span>
  );
}

function MiniStat({
  label,
  value,
  color,
  suffix,
  direction,
}: {
  label: string;
  value: string;
  color: "green" | "red" | "yellow" | "brand";
  suffix?: string;
  direction?: "up" | "down";
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
      <p className={`mt-1.5 text-lg font-display font-semibold tabular-nums flex items-center gap-1 whitespace-nowrap ${cls}`}>
        {direction === "up" && <ArrowUp className="size-3.5 shrink-0" />}
        {direction === "down" && <ArrowDown className="size-3.5 shrink-0" />}
        <span className="truncate">{value}</span>
        {suffix && <span className="text-xs text-muted-foreground font-normal ml-1">{suffix}</span>}
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

function CashFlowChart({
  data,
  minPoint,
}: {
  data: { dia: string; saldo: number; entrada: number; saida: number }[];
  minPoint: { dia: string; saldo: number };
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
        Sem vencimentos projetados no período.
      </div>
    );
  }

  const width = 820;
  const height = 288;
  const pad = { top: 16, right: 18, bottom: 34, left: 78 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;
  const values = data.map((d) => d.saldo);
  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(0, ...values);
  const spread = rawMax - rawMin || 1;
  const min = rawMin - spread * 0.12;
  const max = rawMax + spread * 0.12;
  const y = (v: number) => pad.top + ((max - v) / (max - min)) * chartH;
  const x = (i: number) => pad.left + (data.length === 1 ? 0 : (i / (data.length - 1)) * chartW);
  const points = data.map((d, i) => ({ ...d, x: x(i), y: y(d.saldo) }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${pad.top + chartH} L${points[0].x.toFixed(1)},${pad.top + chartH} Z`;
  const minDot = points.find((p) => p.dia === minPoint.dia);
  const tickValues = Array.from({ length: 5 }, (_, i) => min + ((max - min) / 4) * i).reverse();
  const xTickStep = Math.max(1, Math.ceil(data.length / 6));

  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const [activeIdx, setActiveIdx] = React.useState<number | null>(null);

  const handleMove = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const localX = ((clientX - rect.left) / rect.width) * width;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i].x - localX);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    setActiveIdx(best);
  };

  const active = activeIdx != null ? points[activeIdx] : null;
  const tooltipW = 190;
  const tooltipH = 82;
  const tooltipX = active
    ? Math.min(Math.max(active.x - tooltipW / 2, pad.left), width - pad.right - tooltipW)
    : 0;
  const tooltipY = active
    ? Math.max(pad.top, active.y - tooltipH - 14)
    : 0;

  return (
    <svg
      ref={svgRef}
      className="h-full w-full overflow-visible touch-none select-none"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Fluxo de caixa projetado por data de vencimento"
      onMouseMove={(e) => handleMove(e.clientX)}
      onMouseLeave={() => setActiveIdx(null)}
      onTouchStart={(e) => { if (e.touches[0]) handleMove(e.touches[0].clientX); }}
      onTouchMove={(e) => { if (e.touches[0]) handleMove(e.touches[0].clientX); }}
      onTouchEnd={() => setActiveIdx(null)}
    >
      <defs>
        <linearGradient id="cashFlowFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand-blue)" stopOpacity="0.30" />
          <stop offset="100%" stopColor="var(--brand-blue)" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {tickValues.map((tick) => {
        const yy = y(tick);
        return (
          <g key={tick.toFixed(2)}>
            <line x1={pad.left} x2={width - pad.right} y1={yy} y2={yy} stroke="var(--color-border)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
            <text x={pad.left - 10} y={yy + 4} textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">
              {brlShort(tick)}
            </text>
          </g>
        );
      })}
      {min <= 0 && max >= 0 && (
        <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} stroke="var(--status-red)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      )}
      <path d={areaPath} fill="url(#cashFlowFill)" />
      <path d={linePath} fill="none" stroke="var(--brand-blue)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => (
        <g key={`${p.dia}-${i}`}>
          <circle cx={p.x} cy={p.y} r={activeIdx === i ? 5 : 3} fill="var(--brand-blue)" stroke="var(--color-card)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
          {i % xTickStep === 0 && (
            <text x={p.x} y={height - 10} textAnchor="middle" className="fill-muted-foreground text-[11px] tabular-nums">
              {p.dia}
            </text>
          )}
        </g>
      ))}
      {minDot && (
        <circle cx={minDot.x} cy={minDot.y} r="6" fill="var(--status-yellow)" stroke="var(--color-card)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      )}
      {active && (
        <g pointerEvents="none">
          <line x1={active.x} x2={active.x} y1={pad.top} y2={pad.top + chartH} stroke="var(--brand-blue)" strokeOpacity="0.4" strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
          <rect x={tooltipX} y={tooltipY} width={tooltipW} height={tooltipH} rx="8" fill="var(--color-card)" stroke="var(--color-border)" vectorEffect="non-scaling-stroke" />
          <text x={tooltipX + 12} y={tooltipY + 20} className="fill-foreground text-[12px] font-semibold">{active.dia}</text>
          <text x={tooltipX + 12} y={tooltipY + 38} className="fill-muted-foreground text-[11px]">Saldo:</text>
          <text x={tooltipX + tooltipW - 12} y={tooltipY + 38} textAnchor="end" className="fill-[var(--brand-blue)] text-[11px] tabular-nums font-semibold">{brl(active.saldo)}</text>
          <text x={tooltipX + 12} y={tooltipY + 54} className="fill-muted-foreground text-[11px]">↑ Entradas:</text>
          <text x={tooltipX + tooltipW - 12} y={tooltipY + 54} textAnchor="end" className="fill-[var(--status-green)] text-[11px] tabular-nums">{brl(active.entrada)}</text>
          <text x={tooltipX + 12} y={tooltipY + 70} className="fill-muted-foreground text-[11px]">↓ Saídas:</text>
          <text x={tooltipX + tooltipW - 12} y={tooltipY + 70} textAnchor="end" className="fill-[var(--status-red)] text-[11px] tabular-nums">{brl(active.saida)}</text>
        </g>
      )}
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

function SortToggle({
  value,
  onChange,
}: {
  value: "valor" | "dias";
  onChange: (v: "valor" | "dias") => void;
}) {
  return (
    <div className="flex gap-1 p-1 rounded-md bg-muted print:hidden">
      {(["valor", "dias"] as const).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${
            value === k ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {k === "valor" ? "Valor" : "Dias"}
        </button>
      ))}
    </div>
  );
}
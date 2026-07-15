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
  const [resultadoPeriodo, setResultadoPeriodo] = React.useState<7 | 15 | 30 | 60 | 90 | 180>(30);
  const [pagarSort, setPagarSort] = React.useState<"valor" | "dias">("valor");
  const [clientesSort, setClientesSort] = React.useState<"valor" | "dias">("valor");
  const [showProtestadas, setShowProtestadas] = React.useState(false);
  const [showVencReceber, setShowVencReceber] = React.useState(false);
  const [showVencPagar, setShowVencPagar] = React.useState(false);
  const [showHoje, setShowHoje] = React.useState(false);
  const [showSemana, setShowSemana] = React.useState(false);
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
  // Resultado por janela: soma entradas/saídas do fluxo (valor de face, cenário
  // otimista) até o horizonte selecionado. Inclui vencidos aplicados em D0.
  const janela = data.fluxo.slice(0, resultadoPeriodo);
  const entradasJanela = janela.reduce((s, d) => s + d.entrada, 0);
  const saidasJanela = janela.reduce((s, d) => s + d.saida, 0);
  const resultadoJanela = entradasJanela - saidasJanela;
  const saldoAtual = data.saldoBancarioTotal;
  const fluxoChart = data.fluxoRealista
    .slice(0, 30)
    .map((f) => ({ dia: f.label, saldo: f.saldo, entrada: f.entrada, saida: f.saida }));
  const bancos = data.bancos.map((b, i) => ({ ...b, cor: BANK_COLORS[i % BANK_COLORS.length] }));

  // Necessidade de capital de giro do mês (restante do mês corrente):
  // saídas previstas − entradas previstas (com taxa de recuperação) − saldo atual.
  // Se o resultado for positivo, é o quanto falta captar/negociar para fechar o mês.
  const hojeRef = new Date(); hojeRef.setHours(0, 0, 0, 0);
  const fimMes = new Date(hojeRef.getFullYear(), hojeRef.getMonth() + 1, 0);
  const fimMesStr = fimMes.toISOString().slice(0, 10);
  const doMes = data.fluxoRealista.filter((d) => d.dia <= fimMesStr);
  const entradaMes = doMes.reduce((s, d) => s + d.entrada, 0);
  const saidaMes = doMes.reduce((s, d) => s + d.saida, 0);
  const saldoFimMes = saldoAtual + entradaMes - saidaMes;
  const necessidadeMes = Math.max(0, -saldoFimMes);
  const fimMesLabel = fimMes.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });

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
  // Nota: o resultado projetado (positivo/negativo) já é exibido no card
  // "Resultado de Faturas em Aberto" — evitamos duplicar o sinal aqui.

  // Semáforo considera os próximos 7 dias (entradas x saídas previstas).
  const proximos7 = data.fluxo.slice(0, 7);
  const entradas7 = proximos7.reduce((s, d) => s + d.entrada, 0);
  const saidas7 = proximos7.reduce((s, d) => s + d.saida, 0);
  const resultado7 = entradas7 - saidas7;
  const semaforoState: "green" | "yellow" | "red" =
    resultado7 < 0 || data.aPagarVencidosCount > 5 ? "red"
    : data.aReceberVencidosCount > 0 || data.aPagarVencidosCount > 0 ? "yellow" : "green";
  const semaforoLabel = semaforoState === "green" ? "Saudável" : semaforoState === "yellow" ? "Atenção" : "Crítico";
  const semaforoHint = `Próx. 7 dias: ${resultado7 >= 0 ? "+" : ""}${brl(resultado7)}`;

  const ultimaFmt = data.ultimaImportacao
    ? new Date(data.ultimaImportacao).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
    : "—";

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 max-w-[1440px] mx-auto">
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
      <header className="grid grid-cols-1 gap-4 sm:flex sm:flex-wrap sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold">
            Visão Consolidada
          </p>
          <h1 className="mt-1 text-2xl sm:text-3xl md:text-4xl font-display font-bold text-foreground tracking-tight">
            Painel do CEO
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Fonte: ERP · última importação em {ultimaFmt}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
        <StatusPill state={semaforoState} label={semaforoLabel} hint={semaforoHint} />
        <button
          type="button"
          onClick={() => window.print()}
          className="print:hidden inline-flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-card text-sm font-medium hover:bg-muted transition-colors"
          title="Imprimir ou salvar em PDF"
        >
          <Printer className="size-4" />
          <span className="hidden sm:inline">Exportar / Imprimir</span>
          <span className="sm:hidden">Imprimir</span>
        </button>
        </div>
      </header>

      {/* FAIXA 1 — HERO */}
      <section className="grid grid-cols-12 gap-6">
        <Card className="col-span-12 lg:col-span-8">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Label info="Diferença entre entradas (a receber) e saídas (a pagar) previstas no período selecionado, com base nas faturas em aberto importadas do ERP. Vencidos entram/saem em D0. Positivo = sobra prevista; negativo = necessidade de caixa.">
                Resultado de Faturas em Aberto
              </Label>
              <div className="flex flex-wrap gap-1 p-1 rounded-md bg-muted">
                {([7, 15, 30, 60, 90, 180] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setResultadoPeriodo(p)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors ${
                      p === resultadoPeriodo ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p}d
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2 min-w-0">
              <h2
                className={`font-display font-bold tabular-nums tracking-tight whitespace-nowrap ${resultadoJanela >= 0 ? "text-status-green" : "text-status-red"}`}
                style={{ fontSize: "clamp(1.25rem, 6cqi, 3rem)" }}
              >
                {resultadoJanela >= 0 ? "+" : ""}{brl(resultadoJanela)}
              </h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm font-semibold pb-2 min-w-0">
                <span className="inline-flex items-center gap-1 text-status-green">
                  <ArrowUp className="size-4" />
                  Entradas {brl(entradasJanela)}
                </span>
                <span className="text-muted-foreground hidden sm:inline">·</span>
                <span className="inline-flex items-center gap-1 text-status-red">
                  <ArrowDown className="size-4" />
                  Saídas {brl(saidasJanela)}
                </span>
              </div>
            </div>
            {fluxoChart.length > 0 && (
              <MiniSparkline data={fluxoChart.slice(0, 14).map((d) => d.saldo)} />
            )}
          </div>
        </Card>

        <Card className="col-span-12 lg:col-span-4 bg-primary text-primary-foreground">
          <div className="flex flex-col justify-center h-full gap-2">
            <Label className="text-primary-foreground/70" info="Soma dos saldos das contas bancárias cadastradas. Para cada empresa+conta somamos apenas o lançamento mais recente — os anteriores ficam preservados como histórico e não são contabilizados de novo." infoOnDark>Saldo bancário atual</Label>
            <p
              className="mt-2 font-display font-bold tabular-nums whitespace-nowrap"
              style={{ fontSize: "clamp(1.125rem, 9cqi, 2rem)" }}
            >
              {brl(saldoAtual)}
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
        </Card>
      </section>

      {/* FAIXA 2 — KPIs principais */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <KpiCard
          label="A Receber - GERAL"
          value={brl(data.aReceberTotal)}
          hint="Total em aberto, somando todos os vencimentos (passados e futuros)."
          info="Soma de todas as faturas de clientes ainda não pagas, incluindo as já vencidas e as com vencimento futuro. Não desconta possíveis perdas — é o valor de face."
          accent="green"
          direction="up"
          delta={data.deltas ? { ...data.deltas.aReceber, baseDate: data.deltas.baseDate, goodWhen: "up" } : null}
        />
        <KpiCard
          label="A Pagar - GERAL"
          value={brl(data.aPagarTotal)}
          hint="Total em aberto, somando todos os vencimentos (passados e futuros)."
          info="Soma de todas as contas com fornecedores ainda não quitadas, incluindo as já vencidas e as com vencimento futuro."
          accent="red"
          direction="down"
          delta={data.deltas ? { ...data.deltas.aPagar, baseDate: data.deltas.baseDate, goodWhen: "down" } : null}
        />
      </section>

      {/* FAIXA 2.1 — Vencidos e Protestadas (cada card abre modal com a lista completa) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <VencidoCard
          tone="green"
          icon="up"
          label="Vencidos a Receber"
          info="Faturas de clientes já vencidas e ainda pendentes (não inclui as protestadas). Clique para ver a lista completa."
          valor={data.aReceberVencidosValor}
          count={data.aReceberVencidosCount}
          countLabel={{ one: "título pendente", many: "títulos pendentes" }}
          onOpen={data.aReceberVencidosCount > 0 ? () => setShowVencReceber(true) : undefined}
        />
        <VencidoCard
          tone="red"
          icon="down"
          label="Vencidos a Pagar"
          info="Contas com fornecedores já vencidas. Risco de juros, multas e protesto — priorize a regularização. Clique para ver a lista completa."
          valor={data.aPagarVencidosValor}
          count={data.aPagarVencidosCount}
          countLabel={{ one: "título vencido", many: "títulos vencidos" }}
          onOpen={data.aPagarVencidosCount > 0 ? () => setShowVencPagar(true) : undefined}
        />
        <VencidoCard
          tone="yellow"
          icon="warn"
          label="Protestadas"
          info="Faturas de clientes já enviadas a cartório (situação 'Protestada'). Estão fora de 'Vencidos a Receber' para não misturar atraso comum com títulos já em cobrança cartorial. Clique para ver a lista completa."
          valor={data.aReceberProtestadoValor}
          count={data.aReceberProtestadoCount}
          countLabel={{ one: "título protestado", many: "títulos protestados" }}
          onOpen={data.aReceberProtestadoCount > 0 ? () => setShowProtestadas(true) : undefined}
        />
      </section>

      {showProtestadas && (
        <DetalheModal
          title="Faturas protestadas"
          items={data.protestadas.map((r) => ({
            entidade: r.cliente,
            descricao: r.descricao,
            numero: r.numero,
            empresaCnpj: r.empresaCnpj,
            empresaNome: r.empresaNome,
            venc: r.venc,
            dias: r.dias,
            valor: r.valor,
            status: r.situacao,
          }))}
          total={data.aReceberProtestadoValor}
          entidadeLabel="Cliente"
          statusLabel="Status"
          tone="yellow"
          onClose={() => setShowProtestadas(false)}
        />
      )}
      {showVencReceber && (
        <DetalheModal
          title="Vencidos a Receber"
          items={data.topClientesVencidos.map((r) => ({
            entidade: r.cliente,
            descricao: r.descricao,
            numero: r.numero,
            empresaCnpj: r.empresaCnpj,
            empresaNome: r.empresaNome,
            venc: r.venc,
            dias: r.dias,
            valor: r.valor,
            status: "Pendente",
          }))}
          total={data.aReceberVencidosValor}
          entidadeLabel="Cliente"
          statusLabel="Status"
          tone="green"
          onClose={() => setShowVencReceber(false)}
        />
      )}
      {showVencPagar && (
        <DetalheModal
          title="Vencidos a Pagar"
          items={data.topVencidos.map((r) => ({
            entidade: r.fornecedor,
            descricao: r.descricao,
            numero: r.numero,
            empresaCnpj: r.empresaCnpj,
            empresaNome: r.empresaNome,
            venc: r.venc,
            dias: r.dias,
            valor: r.valor,
            status: "Em atraso",
          }))}
          total={data.aPagarVencidosValor}
          entidadeLabel="Fornecedor"
          statusLabel="Status"
          tone="red"
          onClose={() => setShowVencPagar(false)}
        />
      )}


      {/* FAIXA 3 — HOJE / SEMANA */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card
          onClick={data.hojeItems.length > 0 ? () => setShowHoje(true) : undefined}
          ariaLabel={data.hojeItems.length > 0 ? "Ver detalhamento dos movimentos de hoje" : undefined}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label info="Movimentações previstas para o dia de hoje: quanto entra (recebimentos com vencimento hoje) e quanto sai (pagamentos com vencimento hoje).">Hoje · {new Date().toLocaleDateString("pt-BR")}</Label>
            {data.hojeItems.length > 0 ? (
              <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Ver detalhes →</span>
            ) : (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Movimentos previstos</span>
            )}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4">
            <MiniStat label="A Receber" value={brl(data.hoje.receber)} color="green" direction="up" />
            <MiniStat label="A Pagar" value={brl(data.hoje.pagar)} color="red" direction="down" />
          </div>
        </Card>
        <Card
          onClick={data.semanaItems.length > 0 ? () => setShowSemana(true) : undefined}
          ariaLabel={data.semanaItems.length > 0 ? "Ver detalhamento dos movimentos desta semana" : undefined}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label info="Total previsto de entradas e saídas nos próximos 7 dias (a partir de hoje). Resultado = Receber − Pagar do período.">Esta Semana</Label>
            {data.semanaItems.length > 0 ? (
              <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Ver detalhes →</span>
            ) : (
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">7 dias</span>
            )}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-4">
            <MiniStat label="A Receber" value={brl(data.semana.receber)} color="green" direction="up" />
            <MiniStat label="A Pagar" value={brl(data.semana.pagar)} color="red" direction="down" />
            <MiniStat label="Resultado" value={brl(data.semana.receber - data.semana.pagar)} color="brand" />
          </div>
        </Card>
      </section>

      {showHoje && (
        <DetalheModal
          title={`Movimentos de hoje · ${new Date().toLocaleDateString("pt-BR")}`}
          items={data.hojeItems.map((r) => ({
            entidade: r.entidade,
            descricao: r.descricao,
            numero: r.numero,
            empresaCnpj: r.empresaCnpj,
            empresaNome: r.empresaNome,
            venc: r.venc,
            dias: r.dias,
            valor: r.valor,
            status: r.kind === "receber" ? "A Receber" : "A Pagar",
            tone: r.kind === "receber" ? "green" : "red",
          }))}
          total={data.hoje.receber + data.hoje.pagar}
          entidadeLabel="Cliente / Fornecedor"
          statusLabel="Tipo"
          tone="yellow"
          onClose={() => setShowHoje(false)}
          kindFilter
        />
      )}
      {showSemana && (
        <DetalheModal
          title="Movimentos dos próximos 7 dias"
          items={data.semanaItems.map((r) => ({
            entidade: r.entidade,
            descricao: r.descricao,
            numero: r.numero,
            empresaCnpj: r.empresaCnpj,
            empresaNome: r.empresaNome,
            venc: r.venc,
            dias: r.dias,
            valor: r.valor,
            status: r.kind === "receber" ? "A Receber" : "A Pagar",
            tone: r.kind === "receber" ? "green" : "red",
          }))}
          total={data.semana.receber + data.semana.pagar}
          entidadeLabel="Cliente / Fornecedor"
          statusLabel="Tipo"
          tone="yellow"
          onClose={() => setShowSemana(false)}
          kindFilter
        />
      )}

      {/* FAIXA 3.2 — RESUMO SEMANAL (dia a dia) */}
      <section>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label info="Entradas e saídas previstas dia a dia para os próximos 7 dias. Baseado nos vencimentos das faturas em aberto (cenário otimista, valor de face). Vencidos entram/saem em D0.">
              Resumo Semanal
            </Label>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Próximos 7 dias</span>
          </div>
          <div className="mt-4 -mx-4 md:-mx-6 overflow-x-auto">
            <table className="min-w-full text-xs px-4 md:px-6">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-left font-semibold py-2 pl-4 md:pl-6 pr-3 whitespace-nowrap">Dia</th>
                  <th className="text-right font-semibold py-2 px-3 whitespace-nowrap">Entradas</th>
                  <th className="text-right font-semibold py-2 px-3 whitespace-nowrap">Saídas</th>
                  <th className="text-right font-semibold py-2 pl-3 pr-4 md:pr-6 whitespace-nowrap">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {proximos7.map((d, i) => {
                  const dt = new Date(d.dia + "T00:00:00");
                  const diaSemana = dt.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
                  const res = d.entrada - d.saida;
                  return (
                    <tr key={d.dia}>
                      <td className="py-2 pl-4 md:pl-6 pr-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold w-8 shrink-0">
                            {i === 0 ? "Hoje" : diaSemana}
                          </span>
                          <span className="tabular-nums font-medium">{d.label}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-medium text-status-green whitespace-nowrap">
                        {d.entrada > 0 ? brl(d.entrada) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-medium text-status-red whitespace-nowrap">
                        {d.saida > 0 ? brl(d.saida) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className={`py-2 pl-3 pr-4 md:pr-6 text-right tabular-nums font-semibold whitespace-nowrap ${res >= 0 ? "text-status-green" : "text-status-red"}`}>
                        {res >= 0 ? "+" : ""}{brl(res)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td className="pt-3 pl-4 md:pl-6 pr-3 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold whitespace-nowrap">Total 7 dias</td>
                  <td className="pt-3 px-3 text-right tabular-nums font-bold text-status-green whitespace-nowrap">{brl(entradas7)}</td>
                  <td className="pt-3 px-3 text-right tabular-nums font-bold text-status-red whitespace-nowrap">{brl(saidas7)}</td>
                  <td className={`pt-3 pl-3 pr-4 md:pr-6 text-right tabular-nums font-bold whitespace-nowrap ${resultado7 >= 0 ? "text-status-green" : "text-status-red"}`}>
                    {resultado7 >= 0 ? "+" : ""}{brl(resultado7)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </section>

      {/* FAIXA 4 — SALDOS / ALERTAS (acima do fluxo) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <Label info="Saldo mais recente cadastrado em cada conta bancária, agrupado por empresa. É a base para a projeção do fluxo de caixa.">Saldos por Conta Bancária</Label>
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
                  <p className={`tabular-nums font-semibold ${saldo.saldo >= 0 ? "text-status-green" : "text-status-red"}`}>{brl(saldo.saldo)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <Label info="Sinais automáticos gerados a partir dos dados: títulos vencidos, recebíveis em atraso e resultado projetado (positivo ou negativo).">Alertas</Label>
          <div className="mt-4 space-y-3">
            {alertas.length === 0 && <p className="text-xs text-muted-foreground">Nenhum alerta ativo.</p>}
            {alertas.map((a, i) => <AlertRow key={i} {...a} />)}
          </div>
        </Card>
      </section>

      {/* FAIXA 3.7 — RESULTADO MENSAL PROJETADO */}
      <section>
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label info="Meses ainda não fechados. Para cada mês: soma o valor de face das faturas em aberto (Pendente/Protestada) com vencimento no mês, incluindo vencidas mantidas no mês original. Cada mês é isolado — não considera saldo bancário nem arrasta resultado do mês anterior. Não considera novas vendas — o faturamento só entra após o fechamento dos exames.">
              Resultado Mensal — Projetado
            </Label>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Mês atual + próximos 5 meses</span>
          </div>
          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="text-left font-semibold py-2 pr-3">Mês</th>
                  <th className="text-right font-semibold py-2 px-2">Entrada</th>
                  <th className="text-right font-semibold py-2 px-2">Saída</th>
                  <th className="text-right font-semibold py-2 pl-2">Resultado</th>
                </tr>
              </thead>
              <tbody>
                {data.mesesProjetados.map((m) => (
                  <tr key={m.key} className="border-t border-border">
                    <td className="py-2 pr-3 font-medium">{m.label}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-status-green">{brl(m.entrada)}</td>
                    <td className="py-2 px-2 text-right tabular-nums text-status-red">{brl(m.saida)}</td>
                    <td className={`py-2 pl-2 text-right tabular-nums font-semibold ${m.resultado >= 0 ? "text-status-green" : "text-status-red"}`}>
                      {m.resultado >= 0 ? "+" : ""}{brl(m.resultado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground leading-relaxed">
            Considera apenas faturas <strong>em aberto</strong> (Pendente/Protestada) com vencimento no mês. Cada linha é isolada — sem saldo bancário e sem arrastar resultado de meses anteriores.
          </p>
        </Card>
      </section>

      {/* FAIXA 6 — POSIÇÃO POR EMPRESA (horizontal, abaixo do fluxo) */}
      <section>
        <Card>
          <Label info="Por CNPJ, compara o total em aberto a receber (entradas) com o total a pagar (saídas). Resultado = Receber − Pagar: verde indica sobra prevista, vermelho indica necessidade de caixa naquela empresa.">Posição por Empresa (a receber × a pagar)</Label>
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
                        <span className="tabular-nums text-status-green">{brl(e.receber)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-status-green" style={{ width: `${rPct}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[11px] mb-0.5">
                        <span className="text-muted-foreground">Saída (a pagar)</span>
                        <span className="tabular-nums text-status-red">{brl(e.pagar)}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-status-red" style={{ width: `${pPct}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className={`flex justify-between items-center text-xs pt-1.5 border-t border-border/60`}>
                    <span className="text-muted-foreground">Resultado</span>
                    <span className={`tabular-nums font-semibold ${e.valor >= 0 ? "text-status-green" : "text-status-red"}`}>
                      {e.valor >= 0 ? "+" : ""}{brl(e.valor)}
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
              <Label info="Cinco maiores contas com fornecedores já vencidas. Use para priorizar negociações e evitar juros/multas. Ordene por valor (impacto no caixa) ou por dias (risco de bloqueio/protesto).">Top 5 contas a pagar em atraso</Label>
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
              <Label info="Recebíveis vencidos agrupados por cliente, com faixa de atraso (aging). Quanto mais antigo o atraso, menor a chance de receber sem renegociação. Priorize contato nos blocos vermelhos.">Inadimplência de Clientes</Label>
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

type DetalheItem = {
  entidade: string;
  descricao: string | null;
  numero: string;
  empresaCnpj: string | null;
  empresaNome: string;
  venc: string;
  dias: number;
  valor: number;
  status?: string;
  tone?: "green" | "red" | "yellow";
};

function VencidoCard({
  tone,
  icon,
  label,
  info,
  valor,
  count,
  countLabel,
  onOpen,
}: {
  tone: "green" | "red" | "yellow";
  icon: "up" | "down" | "warn";
  label: string;
  info: string;
  valor: number;
  count: number;
  countLabel: { one: string; many: string };
  onOpen?: () => void;
}) {
  const barCls = tone === "green" ? "bg-status-green" : tone === "red" ? "bg-status-red" : "bg-status-yellow";
  const textCls = tone === "green" ? "text-status-green" : tone === "red" ? "text-status-red" : "text-status-yellow";
  const Icon = icon === "up" ? ArrowUp : icon === "down" ? ArrowDown : AlertTriangle;
  return (
    <Card onClick={onOpen} ariaLabel={onOpen ? `Ver detalhamento de ${label}` : undefined}>
      <div className={`h-0.5 w-8 rounded-full ${barCls} mb-4`} />
      <div className="flex items-center justify-between gap-2">
        <Label info={info}>{label}</Label>
        {onOpen && (
          <span className="text-[10px] uppercase tracking-wider text-primary font-semibold">Ver detalhes →</span>
        )}
      </div>
      <p
        className={`mt-3 font-display font-bold tabular-nums tracking-tight leading-tight flex items-center gap-1.5 whitespace-nowrap ${textCls}`}
        style={{ fontSize: "clamp(0.9rem, 9cqi, 1.75rem)" }}
      >
        <Icon className="size-[0.9em] shrink-0" />
        <span>{brl(valor)}</span>
      </p>
      <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
        {count} {count === 1 ? countLabel.one : countLabel.many}
      </p>
    </Card>
  );
}

function DetalheModal({
  title,
  items,
  total,
  entidadeLabel,
  statusLabel,
  tone,
  onClose,
  kindFilter,
}: {
  title: string;
  items: DetalheItem[];
  total: number;
  entidadeLabel: string;
  statusLabel: string;
  tone: "green" | "red" | "yellow";
  onClose: () => void;
  kindFilter?: boolean;
}) {
  const toneText = (t: "green" | "red" | "yellow") =>
    t === "green" ? "text-status-green" : t === "red" ? "text-status-red" : "text-status-yellow";
  const toneBadge = (t: "green" | "red" | "yellow") =>
    t === "green" ? "bg-status-green/10 text-status-green"
    : t === "red" ? "bg-status-red/10 text-status-red"
    : "bg-status-yellow/10 text-status-yellow";
  const toneCls = toneText(tone);
  const [filter, setFilter] = React.useState<"todos" | "receber" | "pagar">("todos");
  const [sortKey, setSortKey] = React.useState<"venc" | "valor">("venc");
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("asc");
  const toggleSort = (key: "venc" | "valor") => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "valor" ? "desc" : "asc"); }
  };
  const filteredItems = React.useMemo(() => {
    const base = !kindFilter || filter === "todos"
      ? items
      : items.filter((r) => r.tone === (filter === "receber" ? "green" : "red"));
    const sorted = [...base].sort((a, b) => {
      const va = sortKey === "venc" ? a.venc : a.valor;
      const vb = sortKey === "venc" ? b.venc : b.valor;
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [items, filter, kindFilter, sortKey, sortDir]);
  const filteredTotal = React.useMemo(
    () => (kindFilter && filter !== "todos" ? filteredItems.reduce((s, r) => s + r.valor, 0) : total),
    [filteredItems, filter, kindFilter, total],
  );
  const countReceber = React.useMemo(() => items.filter((r) => r.tone === "green").length, [items]);
  const countPagar = React.useMemo(() => items.filter((r) => r.tone === "red").length, [items]);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-foreground/40 backdrop-blur-sm p-0 sm:p-6 print:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-card border border-border shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-5 border-b border-border">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold">Detalhamento</p>
            <h2 className="mt-1 text-lg sm:text-xl font-display font-bold">{title}</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {filteredItems.length} {filteredItems.length === 1 ? "título" : "títulos"} · Total {brl(filteredTotal)}
            </p>
            {kindFilter && (
              <div className="mt-3 inline-flex flex-wrap gap-1 p-1 rounded-md bg-muted">
                {([
                  { key: "todos", label: `Todos (${items.length})` },
                  { key: "receber", label: `A Receber (${countReceber})` },
                  { key: "pagar", label: `A Pagar (${countPagar})` },
                ] as const).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setFilter(opt.key)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-sm transition-colors ${
                      filter === opt.key
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="shrink-0 h-9 px-3 rounded-md border border-border text-sm font-medium hover:bg-muted transition-colors"
          >
            Fechar
          </button>
        </div>
        <div className="overflow-auto">
          {filteredItems.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nenhum título encontrado.</p>
          ) : (
            <table className="w-full min-w-[640px] text-xs table-auto">
              <thead className="sticky top-0 bg-muted/60 backdrop-blur text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="text-left font-semibold py-2.5 px-3 sm:px-4 w-[38%] sm:w-auto">{entidadeLabel}</th>
                  <th className="text-left font-semibold py-2.5 px-3 hidden md:table-cell">Empresa</th>
                  <th className="text-left font-semibold py-2.5 px-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort("venc")}
                      className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground transition-colors"
                    >
                      Vencimento
                      <span className="text-[9px]">{sortKey === "venc" ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span>
                    </button>
                  </th>
                  <th className="text-right font-semibold py-2.5 px-3 whitespace-nowrap hidden sm:table-cell">Dias atraso</th>
                  <th className="text-left font-semibold py-2.5 px-3 whitespace-nowrap">{statusLabel}</th>
                  <th className="text-right font-semibold py-2.5 px-3 sm:px-4 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => toggleSort("valor")}
                      className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground transition-colors"
                    >
                      Valor
                      <span className="text-[9px]">{sortKey === "valor" ? (sortDir === "asc" ? "▲" : "▼") : "↕"}</span>
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredItems.map((r, i) => (
                  <tr key={`${r.numero}-${i}`} className="align-top">
                    <td className="py-2.5 px-3 sm:px-4 min-w-0">
                      <div className="font-medium break-words">{r.entidade}</div>
                      {r.descricao && <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 break-words">{r.descricao}</div>}
                      <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">Nº {r.numero}</div>
                      <div className="sm:hidden text-[10px] text-muted-foreground mt-0.5">
                        {r.empresaNome}{r.dias > 0 ? ` · ${r.dias}d atraso` : ""}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 hidden md:table-cell min-w-0">
                      <div className="text-[12px] break-words">{r.empresaNome}</div>
                      {r.empresaCnpj && <div className="text-[10px] text-muted-foreground tabular-nums">{r.empresaCnpj}</div>}
                    </td>
                    <td className="py-2.5 px-3 tabular-nums whitespace-nowrap">
                      {new Date(r.venc + "T00:00:00").toLocaleDateString("pt-BR")}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap hidden sm:table-cell">
                      {r.dias > 0 ? `${r.dias} d` : "—"}
                    </td>
                     <td className="py-2.5 px-3">
                       <span className={`inline-flex items-center whitespace-nowrap rounded-full ${toneBadge(r.tone ?? tone)} px-2 py-0.5 text-[9px] uppercase tracking-wide font-semibold`}>
                         {r.status ?? "—"}
                       </span>
                     </td>
                    <td className={`py-2.5 px-3 sm:px-4 text-right tabular-nums font-semibold ${toneText(r.tone ?? tone)} whitespace-nowrap`}>
                      {brl(r.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted/40">
                <tr>
                  <td colSpan={5} className="py-3 px-3 sm:px-4 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Total</td>
                  <td className={`py-3 px-3 sm:px-4 text-right tabular-nums font-bold ${toneCls}`}>{brl(filteredTotal)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function Card({ children, className = "", onClick, ariaLabel }: { children: React.ReactNode; className?: string; onClick?: () => void; ariaLabel?: string }) {
  const interactive = !!onClick;
  return (
    <div
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={interactive ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } } : undefined}
      className={`rounded-xl border border-border bg-card p-4 md:p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] min-w-0 [container-type:inline-size] ${interactive ? "cursor-pointer transition-shadow hover:shadow-[0_4px_12px_rgba(15,23,42,0.08)] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

function Label({ children, className = "", info, infoOnDark }: { children: React.ReactNode; className?: string; info?: string; infoOnDark?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground ${className}`}>
      <span>{children}</span>
      {info && <InfoTooltip text={info} onDark={infoOnDark} />}
    </span>
  );
}

function InfoTooltip({ text, onDark }: { text: string; onDark?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLSpanElement | null>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, [open]);
  const btnCls = onDark
    ? "border-white/30 bg-white/10 text-primary-foreground hover:bg-white/20"
    : "border-border bg-muted text-muted-foreground hover:bg-muted-foreground/10 hover:text-foreground";
  return (
    <span ref={ref} className="relative inline-flex print:hidden normal-case tracking-normal">
      <button
        type="button"
        aria-label="Mais informações"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className={`inline-flex items-center justify-center size-4 rounded-full border text-[10px] font-bold italic leading-none transition-colors ${btnCls}`}
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-50 mt-2 w-64 -translate-x-1/2 rounded-md border border-border bg-card px-3 py-2 text-[11px] font-normal leading-snug text-foreground shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
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
      <p className={`mt-1.5 text-lg font-display font-bold tabular-nums ${text}`}>{brl(valor)}</p>
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
    <div className="flex h-2 w-full rounded-full overflow-hidden bg-muted" title={`≤30d ${brl(aging.a30)} · 31-60d ${brl(aging.a60)} · 61-90d ${brl(aging.a90)} · +90d ${brl(aging.mais)}`}>
      {aging.a30 > 0 && <div className="bg-status-yellow" style={{ width: seg(aging.a30) }} />}
      {aging.a60 > 0 && <div className="bg-orange-500" style={{ width: seg(aging.a60) }} />}
      {aging.a90 > 0 && <div className="bg-status-red" style={{ width: seg(aging.a90) }} />}
      {aging.mais > 0 && <div className="bg-red-800" style={{ width: seg(aging.mais) }} />}
    </div>
  );
}

function ConcentracaoCard({
  titulo, descricao, itens, total, top5Pct, hhi, tone,
}: {
  titulo: string;
  descricao: string;
  itens: { nome: string; valor: number; pct: number; qtd: number }[];
  total: number;
  top5Pct: number;
  hhi: number;
  tone: "green" | "red";
}) {
  // HHI: <1500 baixa · 1500-2500 moderada · >2500 alta concentração (parâmetro clássico)
  const nivel = hhi > 2500 ? { label: "Alta", cls: "text-status-red" }
              : hhi > 1500 ? { label: "Moderada", cls: "text-status-yellow" }
              : { label: "Baixa", cls: "text-status-green" };
  const barCls = tone === "green" ? "bg-status-green" : "bg-status-red";
  const valorCls = tone === "green" ? "text-status-green" : "text-status-red";
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Label info="O ranking é por VALOR em aberto (soma das faturas não pagas por entidade), não pela quantidade de títulos. A coluna 'X títulos' é só informativa — mostra quantas faturas compõem aquele valor. O % indica a fatia daquela entidade no total (a receber ou a pagar).">{titulo}</Label>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">{descricao}</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Top 5</p>
            <p className="text-sm font-display font-bold tabular-nums">{top5Pct.toFixed(0)}%</p>
          </div>
          <div className="text-right border-l border-border pl-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Concentração</p>
            <p className={`text-sm font-display font-bold ${nivel.cls}`}>{nivel.label}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {itens.length === 0 && <p className="text-xs text-muted-foreground">Sem dados</p>}
        {itens.map((it, i) => (
          <div key={i} className="grid grid-cols-[1.25rem_1fr_auto] gap-2 items-center">
            <span className="text-[10px] tabular-nums text-muted-foreground text-right">{i + 1}.</span>
            <div className="min-w-0">
              <div className="flex justify-between text-[12px] mb-1 gap-2">
                <span className="truncate font-medium" title={it.nome}>{it.nome}</span>
                <span className="tabular-nums text-muted-foreground shrink-0">
                  {it.qtd} {it.qtd === 1 ? "título" : "títulos"}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barCls}`} style={{ width: `${Math.min(100, it.pct)}%` }} />
              </div>
            </div>
            <div className="text-right shrink-0 min-w-[92px]">
              <div className={`text-[12px] tabular-nums font-semibold ${valorCls}`}>{brl(it.valor)}</div>
              <div className="text-[10px] tabular-nums text-muted-foreground">{it.pct.toFixed(1)}%</div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function StatusPill({ state, label, hint }: { state: "green" | "yellow" | "red"; label: string; hint: string }) {
  const cls = {
    green: "bg-status-green/10 text-status-green",
    yellow: "bg-status-yellow/10 text-status-yellow",
    red: "bg-status-red/10 text-status-red",
  }[state];
  const Icon = state === "green" ? CheckCircle2 : state === "yellow" ? AlertTriangle : AlertTriangle;
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div
      ref={rootRef}
      className="group relative flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2 shadow-sm cursor-help select-none"
      tabIndex={0}
      role="button"
      aria-expanded={open}
      aria-label="Regra do semáforo"
      onClick={() => setOpen((v) => !v)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setOpen((v) => !v);
        }
      }}
    >
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
      <div
        role="tooltip"
        className={`absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-border bg-popover p-3 text-left text-xs text-popover-foreground shadow-lg transition-all duration-150 ${
          open
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-1 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100 group-focus-within:translate-y-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-2 font-semibold text-foreground">Regra do semáforo (próx. 7 dias)</p>
        <ul className="space-y-1.5">
          <li className="flex items-start gap-2">
            <span className="mt-1 size-2 shrink-0 rounded-full bg-status-green" />
            <span><strong className="text-status-green">Verde · Saudável</strong> — resultado dos 7 dias ≥ 0 <em>e</em> nenhum título vencido.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 size-2 shrink-0 rounded-full bg-status-yellow" />
            <span><strong className="text-status-yellow">Amarelo · Atenção</strong> — resultado dos 7 dias ≥ 0, mas existem títulos vencidos (a receber ou a pagar).</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 size-2 shrink-0 rounded-full bg-status-red" />
            <span><strong className="text-status-red">Vermelho · Crítico</strong> — resultado dos 7 dias &lt; 0 (saídas superam entradas na janela).</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  hint,
  info,
  accent,
  extra,
  direction,
  delta,
}: {
  label: string;
  value: string;
  hint: string;
  info?: string;
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
      <Label info={info}>{label}</Label>
      <p className={`mt-3 font-display font-bold tabular-nums tracking-tight leading-tight flex items-center gap-1.5 whitespace-nowrap ${valueCls}`}
         style={{ fontSize: "clamp(0.9rem, 9cqi, 1.75rem)" }}>
        {direction === "up" && <ArrowUp className="size-[0.9em] shrink-0" />}
        {direction === "down" && <ArrowDown className="size-[0.9em] shrink-0" />}
        <span>{value}</span>
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
  const pctTxt = pct == null
    ? (isZero ? "—" : `${abs > 0 ? "+" : ""}${brl(abs)}`)
    : `${pct > 0 ? "+" : ""}${pct.toFixed(1).replace(".", ",")}%`;
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
    <div className="min-w-0 overflow-hidden" style={{ containerType: "inline-size" }}>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p
        className={`mt-1.5 font-display font-semibold tabular-nums flex items-center gap-1 whitespace-nowrap ${cls}`}
        style={{ fontSize: "clamp(0.75rem, 11cqi, 1.125rem)" }}
      >
        {direction === "up" && <ArrowUp className="size-[0.9em] shrink-0" />}
        {direction === "down" && <ArrowDown className="size-[0.9em] shrink-0" />}
        <span>{value}</span>
        {suffix && <span className="text-[0.75em] text-muted-foreground font-normal ml-1">{suffix}</span>}
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
              {brl(tick)}
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
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { loadDupGroups, type DupGroup } from "@/lib/duplicatas";
import { mergeDuplicateGroup } from "@/lib/duplicatas.functions";
import { useCurrentUser } from "@/lib/auth";
import { AlertTriangle, CheckCircle2, Loader2, Lock, Merge } from "lucide-react";

export const Route = createFileRoute("/_authenticated/duplicatas-revisao")({
  head: () => ({
    meta: [
      { title: "Duplicatas em revisão | Painel PreverMed" },
      { name: "description", content: "Revisão manual de possíveis duplicatas de faturas a pagar com vencimentos diferentes." },
      { property: "og:title", content: "Duplicatas em revisão | Painel PreverMed" },
      { property: "og:description", content: "Revisão manual de possíveis duplicatas de faturas a pagar com vencimentos diferentes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppShell>
      <DuplicatasPage />
    </AppShell>
  ),
});

const brl = (v: number) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dt = (s: string | null) => (s ? new Date(s + "T00:00:00").toLocaleDateString("pt-BR") : "—");

function DuplicatasPage() {
  const { data: me } = useCurrentUser();
  const qc = useQueryClient();
  const doMerge = useServerFn(mergeDuplicateGroup);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<null | { kind: "ok" | "err"; msg: string }>(null);

  const canWrite = !!me?.isOperator;
  const { data: groups, isLoading } = useQuery<DupGroup[]>({
    queryKey: ["duplicatas-revisao"],
    queryFn: loadDupGroups,
    staleTime: 30_000,
  });

  const handleMerge = async (g: DupGroup, keepId: string) => {
    if (!canWrite) return;
    const removeIds = g.rows.filter((r) => r.id !== keepId).map((r) => r.id);
    const keep = g.rows.find((r) => r.id === keepId)!;
    if (!confirm(`Manter o vencimento ${dt(keep.data_vencimento)} e remover ${removeIds.length} linha(s) deste grupo?`)) return;
    setBusyId(keepId);
    setStatus(null);
    try {
      await doMerge({ data: { keepId, removeIds } });
      setStatus({ kind: "ok", msg: `Grupo ${g.numero} mesclado — mantido o vencimento ${dt(keep.data_vencimento)}.` });
      await qc.invalidateQueries({ queryKey: ["duplicatas-revisao"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      setStatus({ kind: "err", msg: e instanceof Error ? e.message : "Erro ao mesclar" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-[1200px] mx-auto space-y-6">
      <header>
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold">Operação</p>
        <h1 className="mt-1 text-2xl md:text-4xl font-display font-bold tracking-tight">Duplicatas em revisão</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Faturas <strong>a pagar</strong> com o mesmo número, documento da entidade e unidade de negócio, mas vencimentos diferentes,
          onde nenhuma linha está “Paga”. Enquanto o grupo estiver aqui, o painel conta o valor <strong>uma única vez</strong>
          {" "}(vencimento mais próximo de hoje). Grupos com uma linha já paga seguem a regra automática.
        </p>
      </header>

      {!canWrite && (
        <div className="rounded-lg border border-status-yellow/30 bg-status-yellow/5 p-4 text-sm text-status-yellow flex items-center gap-2">
          <Lock className="size-4" /> Seu perfil permite apenas visualizar esta lista.
        </div>
      )}

      {status && (
        <div className={`rounded-lg border p-4 flex items-start gap-3 text-sm ${
          status.kind === "ok"
            ? "border-status-green/30 bg-status-green/5 text-status-green"
            : "border-status-red/30 bg-status-red/5 text-status-red"
        }`}>
          {status.kind === "ok" ? <CheckCircle2 className="size-4 mt-0.5" /> : <AlertTriangle className="size-4 mt-0.5" />}
          <span>{status.msg}</span>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Carregando grupos…
        </div>
      )}

      {!isLoading && (groups?.length ?? 0) === 0 && (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Nenhuma duplicata pendente de revisão. 🎉
        </div>
      )}

      <div className="space-y-4">
        {(groups ?? []).map((g) => (
          <section key={g.key} className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-x-4 gap-y-1">
              <div className="min-w-0">
                <p className="font-semibold truncate">{g.entidade}</p>
                <p className="text-xs text-muted-foreground truncate">
                  Nº {g.numero} · Doc {g.entidade_doc || "—"} · {g.unidade_negocio}
                </p>
              </div>
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-status-yellow/10 text-status-yellow px-2.5 py-1 text-xs font-semibold">
                <AlertTriangle className="size-3.5" />
                {g.spreadDays} dia(s) de diferença
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[560px]">
                <thead className="bg-muted/40">
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="text-left font-semibold px-4 py-2.5">Vencimento</th>
                    <th className="text-left font-semibold px-4 py-2.5">Situação</th>
                    <th className="text-right font-semibold px-4 py-2.5">Valor</th>
                    <th className="text-right font-semibold px-4 py-2.5">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {g.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 tabular-nums font-medium whitespace-nowrap">{dt(r.data_vencimento)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-muted text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                          {r.situacao || "Pendente"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{brl(Number(r.valor_parcela))}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={!canWrite || busyId !== null}
                          onClick={() => handleMerge(g, r.id)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 text-accent px-2.5 py-1 text-xs font-semibold hover:bg-accent/20 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap"
                        >
                          {busyId === r.id ? <Loader2 className="size-3.5 animate-spin" /> : <Merge className="size-3.5" />}
                          Mesclar, mantendo esta linha
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

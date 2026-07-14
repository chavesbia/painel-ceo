import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth";
import { AlertCircle, CheckCircle2, Landmark, Loader2, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/saldos")({
  component: () => (
    <AppShell>
      <BalancesPage />
    </AppShell>
  ),
});

type BalanceRow = {
  id: string;
  company_name: string;
  account_name: string;
  balance: number;
  balance_date: string;
  notes: string | null;
  updated_at: string;
};

type FormState = {
  company_name: string;
  account_name: string;
  balance: string;
  balance_date: string;
  notes: string;
};

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): FormState => ({ company_name: "", account_name: "", balance: "", balance_date: today(), notes: "" });
const brl = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const COMPANIES: { doc: string; name: string }[] = [
  { doc: "37.260.594/0001-80", name: "Prever Alpha Estética e Assessoria (Matriz)" },
  { doc: "46.638.275/0001-56", name: "PreverMed Medicina Ocupacional (Matriz)" },
  { doc: "46.638.275/0002-37", name: "PreverMed Medicina Ocupacional (Filial)" },
  { doc: "96.492.707/0001-31", name: "Prever Centro Médico" },
  { doc: "28.309.721/0001-05", name: "Prever Medical Group" },
];
const companyLabel = (doc: string) => {
  const c = COMPANIES.find((x) => x.doc === doc);
  return c ? `${c.doc} — ${c.name}` : doc;
};
const BANKS: string[] = ["Banco do Brasil"];

function parseMoney(value: string) {
  const normalized = value.trim().replace(/\s/g, "").replace(/R\$/gi, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error("Informe um saldo válido.");
  return parsed;
}

function BalancesPage() {
  const { data: me } = useCurrentUser();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<null | { kind: "ok" | "err"; msg: string }>(null);

  const canWrite = !!me?.isOperator;
  const canDelete = !!me?.isOperator;

  const { data = [], isLoading } = useQuery<BalanceRow[]>({
    queryKey: ["cash-balances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_balances")
        .select("id,company_name,account_name,balance,balance_date,notes,updated_at")
        .order("balance_date", { ascending: false })
        .order("updated_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data as BalanceRow[]) || [];
    },
  });

  const total = useMemo(() => data.reduce((sum, row) => sum + Number(row.balance || 0), 0), [data]);

  // Saldo atual = soma apenas do lançamento mais recente por (empresa + conta).
  // Mesma lógica usada no Painel do CEO ("Saldo bancário inicial").
  const { saldoAtual, latestIds } = useMemo(() => {
    const latest = new Map<string, BalanceRow>();
    for (const row of data) {
      const key = `${row.company_name}::${row.account_name}`;
      const prev = latest.get(key);
      if (!prev) { latest.set(key, row); continue; }
      const isNewer =
        row.balance_date > prev.balance_date ||
        (row.balance_date === prev.balance_date && row.updated_at > prev.updated_at);
      if (isNewer) latest.set(key, row);
    }
    const ids = new Set<string>();
    let sum = 0;
    latest.forEach((r) => { ids.add(r.id); sum += Number(r.balance || 0); });
    return { saldoAtual: sum, latestIds: ids };
  }, [data]);

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["cash-balances"] }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };

  const update = (key: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const reset = () => setForm(emptyForm());

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canWrite) return;
    setBusy(true);
    setStatus(null);
    try {
      const payload = {
        company_name: form.company_name.trim(),
        account_name: form.account_name.trim(),
        balance: parseMoney(form.balance),
        balance_date: form.balance_date,
        notes: form.notes.trim() || null,
        created_by: me?.id ?? null,
      };
      const result = await supabase.from("cash_balances").insert(payload);
      if (result.error) throw new Error(result.error.message);
      setStatus({ kind: "ok", msg: "Saldo cadastrado." });
      reset();
      await refresh();
    } catch (error) {
      setStatus({ kind: "err", msg: error instanceof Error ? error.message : "Erro ao salvar saldo." });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: BalanceRow) => {
    if (!canDelete || !confirm(`Excluir o saldo de ${row.account_name}?`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("cash_balances").delete().eq("id", row.id);
      if (error) throw new Error(error.message);
      setStatus({ kind: "ok", msg: "Saldo excluído." });
      await refresh();
    } catch (error) {
      setStatus({ kind: "err", msg: error instanceof Error ? error.message : "Erro ao excluir saldo." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold">Operação</p>
          <h1 className="mt-1 text-3xl md:text-4xl font-display font-bold tracking-tight">Saldos</h1>
          <p className="text-sm text-muted-foreground mt-1">Cadastre os saldos bancários para atualizar o fluxo do Painel do CEO.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 text-right" title="Soma apenas do lançamento mais recente de cada conta bancária — é o saldo real disponível hoje. Mesmo valor usado no Painel do CEO.">
            <p className="text-[10px] uppercase tracking-wider text-primary font-semibold">Saldo atual</p>
            <p className={`mt-1 text-2xl font-display font-bold tabular-nums ${saldoAtual >= 0 ? "text-status-green" : "text-status-red"}`}>{brl(saldoAtual)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">último lançamento por conta</p>
          </div>
          <div className="rounded-lg border border-border bg-card px-4 py-3 text-right" title="Soma de TODOS os lançamentos já cadastrados (inclui histórico). Serve apenas para conferência de digitação.">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Soma do histórico</p>
            <p className={`mt-1 text-2xl font-display font-bold tabular-nums ${total >= 0 ? "text-status-green" : "text-status-red"}`}>{brl(total)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">todos os lançamentos</p>
          </div>
        </div>
      </header>

      {status && (
        <div className={`rounded-lg border p-4 flex items-start gap-3 text-sm ${status.kind === "ok" ? "border-status-green/30 bg-status-green/5 text-status-green" : "border-status-red/30 bg-status-red/5 text-status-red"}`}>
          {status.kind === "ok" ? <CheckCircle2 className="size-4 mt-0.5" /> : <AlertCircle className="size-4 mt-0.5" />}
          <span>{status.msg}</span>
        </div>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
        <form onSubmit={save} className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-md bg-primary/10 text-primary flex items-center justify-center"><Landmark className="size-4" /></div>
            <div>
              <h2 className="font-display font-semibold">Novo saldo</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Cada lançamento cria uma nova linha datada. O painel usa sempre o mais recente por conta e mantém os anteriores como histórico.</p>
            </div>
          </div>

          {!canWrite && <p className="rounded-md border border-status-yellow/30 bg-status-yellow/5 px-3 py-2 text-xs text-status-yellow">Seu perfil não permite cadastrar saldos.</p>}

          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">CNPJ da empresa</span>
            <select required disabled={!canWrite || busy} value={form.company_name} onChange={(e) => update("company_name", e.target.value)} className="mt-1 w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
              <option value="">Selecione…</option>
              {COMPANIES.map((c) => (
                <option key={c.doc} value={c.doc}>{c.doc} — {c.name}</option>
              ))}
              {form.company_name && !COMPANIES.some((c) => c.doc === form.company_name) && (
                <option value={form.company_name}>{form.company_name}</option>
              )}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Banco</span>
            <select required disabled={!canWrite || busy} value={form.account_name} onChange={(e) => update("account_name", e.target.value)} className="mt-1 w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
              <option value="">Selecione…</option>
              {BANKS.map((b) => (<option key={b} value={b}>{b}</option>))}
              {form.account_name && !BANKS.includes(form.account_name) && (
                <option value={form.account_name}>{form.account_name}</option>
              )}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Saldo</span>
              <input required disabled={!canWrite || busy} value={form.balance} onChange={(e) => update("balance", e.target.value)} className="mt-1 w-full h-10 rounded-md border border-border bg-background px-3 text-sm tabular-nums" placeholder="0,00" inputMode="decimal" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Data</span>
              <input required disabled={!canWrite || busy} type="date" value={form.balance_date} onChange={(e) => update("balance_date", e.target.value)} className="mt-1 w-full h-10 rounded-md border border-border bg-background px-3 text-sm" />
            </label>
          </div>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Observação</span>
            <textarea disabled={!canWrite || busy} value={form.notes} onChange={(e) => update("notes", e.target.value)} className="mt-1 w-full min-h-20 rounded-md border border-border bg-background px-3 py-2 text-sm resize-none" />
          </label>
          <div className="flex justify-end gap-2">
            <button type="submit" disabled={!canWrite || busy} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Cadastrar saldo
            </button>
          </div>
        </form>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-semibold px-4 py-2.5">Conta</th>
                <th className="text-left font-semibold px-4 py-2.5">Empresa</th>
                <th className="text-left font-semibold px-4 py-2.5">Data</th>
                <th className="text-right font-semibold px-4 py-2.5">Saldo</th>
                <th className="text-right font-semibold px-4 py-2.5">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground"><Loader2 className="inline size-4 animate-spin" /> Carregando…</td></tr>}
              {!isLoading && data.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted-foreground">Nenhum saldo cadastrado.</td></tr>}
              {data.map((row) => {
                const isLatest = latestIds.has(row.id);
                return (
                <tr key={row.id} className={isLatest ? "bg-primary/[0.03]" : ""}>
                  <td className="px-4 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      <span>{row.account_name}</span>
                      {isLatest && <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary font-semibold" title="Este é o lançamento mais recente desta conta — entra no Saldo atual.">Atual</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{companyLabel(row.company_name)}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{new Date(row.balance_date + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${row.balance >= 0 ? "text-status-green" : "text-status-red"}`}>{brl(row.balance)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      {canDelete && (
                        <button type="button" onClick={() => remove(row)} disabled={busy} className="h-8 px-2.5 rounded border border-status-red/30 text-status-red hover:bg-status-red/5 text-xs inline-flex items-center gap-1.5 disabled:opacity-50">
                          <Trash2 className="size-3.5" /> Excluir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
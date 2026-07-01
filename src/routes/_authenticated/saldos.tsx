import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth";
import { AlertCircle, CheckCircle2, Landmark, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<null | { kind: "ok" | "err"; msg: string }>(null);

  const canWrite = !!me?.isOperator;
  const canDelete = !!me?.isAdmin;

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

  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["cash-balances"] }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  };

  const update = (key: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const reset = () => {
    setForm(emptyForm());
    setEditingId(null);
  };

  const edit = (row: BalanceRow) => {
    setEditingId(row.id);
    setForm({
      company_name: row.company_name,
      account_name: row.account_name,
      balance: String(row.balance).replace(".", ","),
      balance_date: row.balance_date,
      notes: row.notes || "",
    });
    setStatus(null);
  };

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
      const result = editingId
        ? await supabase.from("cash_balances").update(payload).eq("id", editingId)
        : await supabase.from("cash_balances").insert(payload);
      if (result.error) throw new Error(result.error.message);
      setStatus({ kind: "ok", msg: editingId ? "Saldo atualizado." : "Saldo cadastrado." });
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
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Saldo total</p>
          <p className={`mt-1 text-2xl font-display font-bold tabular-nums ${total >= 0 ? "text-status-green" : "text-status-red"}`}>{brl(total)}</p>
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
              <h2 className="font-display font-semibold">{editingId ? "Editar saldo" : "Novo saldo"}</h2>
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
            {editingId && <button type="button" onClick={reset} className="h-9 px-3 rounded-md border border-border text-sm hover:bg-muted">Cancelar</button>}
            <button type="submit" disabled={!canWrite || busy} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {editingId ? "Salvar alterações" : "Cadastrar saldo"}
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
              {data.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-medium">{row.account_name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{row.company_name}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{new Date(row.balance_date + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                  <td className={`px-4 py-3 text-right tabular-nums font-semibold ${row.balance >= 0 ? "text-status-green" : "text-status-red"}`}>{brl(row.balance)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button type="button" onClick={() => edit(row)} disabled={!canWrite || busy} className="h-8 px-2.5 rounded border border-border hover:bg-muted text-xs inline-flex items-center gap-1.5 disabled:opacity-50">
                        <Pencil className="size-3.5" /> Editar
                      </button>
                      {canDelete && (
                        <button type="button" onClick={() => remove(row)} disabled={busy} className="h-8 px-2.5 rounded border border-status-red/30 text-status-red hover:bg-status-red/5 text-xs inline-flex items-center gap-1.5 disabled:opacity-50">
                          <Trash2 className="size-3.5" /> Excluir
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { csvToInvoices } from "@/lib/csv";
import { skippedRowsToCsv, type SkippedRow } from "@/lib/csv";
import { importInvoices, deleteImport } from "@/lib/imports.functions";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Lock, Trash2, Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/importacoes")({
  component: () => (
    <AppShell>
      <ImportPage />
    </AppShell>
  ),
});

type ImpRow = {
  id: string;
  kind: "receivable" | "payable";
  filename: string;
  rows_total: number;
  rows_imported: number;
  rows_skipped: number;
  rows_inserted: number | null;
  rows_updated: number | null;
  created_at: string;
};

type HealthRow = {
  id: string;
  checked_at: string;
  source: "import" | "cron";
  import_id: string | null;
  rows_inserted: number | null;
  rows_updated: number | null;
  rows_skipped: number | null;
  duplicate_groups: number;
  duplicate_excess_rows: number;
  duplicate_excess_valor: number;
  details: { filename?: string; kind?: string; total?: number } | null;
};

function ImportPage() {
  const { data: me } = useCurrentUser();
  const [history, setHistory] = useState<ImpRow[]>([]);
  const [health, setHealth] = useState<HealthRow[]>([]);
  const [status, setStatus] = useState<null | { kind: "info" | "ok" | "err"; msg: string }>(null);
  const [busy, setBusy] = useState(false);
  const [lastSkipped, setLastSkipped] = useState<{ filename: string; rows: SkippedRow[] } | null>(null);
  const doImport = useServerFn(importInvoices);
  const doDelete = useServerFn(deleteImport);
  const qc = useQueryClient();

  const load = async () => {
    const [imps, hcs] = await Promise.all([
      supabase.from("imports").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("import_health_checks").select("*").order("checked_at", { ascending: false }).limit(30),
    ]);
    setHistory((imps.data as ImpRow[]) || []);
    setHealth((hcs.data as HealthRow[]) || []);
  };
  useEffect(() => { void load(); }, []);

  const canWrite = !!me?.isOperator;

  const handleDelete = async (id: string, filename: string) => {
    if (!canWrite) return;
    if (!confirm(`Excluir a importação "${filename}"? Todos os registros dela serão removidos.`)) return;
    setBusy(true);
    setStatus({ kind: "info", msg: `Excluindo ${filename}…` });
    try {
      await doDelete({ data: { id } });
      setStatus({ kind: "ok", msg: `Importação "${filename}" excluída.` });
      void load();
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      setStatus({ kind: "err", msg: e instanceof Error ? e.message : "Erro ao excluir" });
    } finally { setBusy(false); }
  };

  const handleFile = async (file: File, kind: "receivable" | "payable") => {
    if (!canWrite) return;
    setBusy(true);
    setLastSkipped(null);
    setStatus({ kind: "info", msg: `Lendo ${file.name}…` });
    try {
      const buf = await file.arrayBuffer();
      const text = new TextDecoder("iso-8859-1").decode(buf);
      const parsed = csvToInvoices(text, kind);
      setStatus({ kind: "info", msg: `Enviando ${parsed.rows.length} registros…` });
      const res = await doImport({ data: { kind, filename: file.name, total: parsed.total, skipped: parsed.skipped, rows: parsed.rows } });
      const dupMsg = res.duplicates && res.duplicates.groups > 0
        ? ` ⚠️ ${res.duplicates.groups} duplicata(s) detectada(s) na base.`
        : " Sem duplicatas detectadas.";
      setStatus({
        kind: res.duplicates && res.duplicates.groups > 0 ? "info" : "ok",
        msg: `Concluído: ${res.inserted} novo(s), ${res.updated} atualizado(s), ${res.skipped} ignorado(s) de ${res.total}.${dupMsg}`,
      });
      if (parsed.skippedRows.length > 0) setLastSkipped({ filename: file.name, rows: parsed.skippedRows });
      void load();
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      setStatus({ kind: "err", msg: e instanceof Error ? e.message : "Erro ao importar" });
    } finally { setBusy(false); }
  };

  const handleDownloadSkipped = () => {
    if (!lastSkipped) return;
    const csv = skippedRowsToCsv(lastSkipped.rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const base = lastSkipped.filename.replace(/\.csv$/i, "");
    a.download = `${base}__ignorados.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto space-y-8">
      <header>
        <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold">Sistema</p>
        <h1 className="mt-1 text-3xl md:text-4xl font-display font-bold tracking-tight">Importações</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Envie os arquivos CSV exportados do ERP (Faturas a Pagar e Faturas a Receber). Registros da empresa CNPJ 37.260.594/0002-60 são excluídos apenas em A Receber (mantidos em A Pagar).
        </p>
      </header>

      {!canWrite && (
        <div className="rounded-lg border border-status-yellow/30 bg-status-yellow/5 p-4 text-sm text-status-yellow flex items-center gap-2">
          <Lock className="size-4" /> Seu perfil não permite importar arquivos. Contate o administrador.
        </div>
      )}

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <UploadCard label="Faturas a Receber" kind="receivable" onFile={handleFile} disabled={busy || !canWrite} />
        <UploadCard label="Faturas a Pagar" kind="payable" onFile={handleFile} disabled={busy || !canWrite} />
      </section>

      {status && (
        <div className={`rounded-lg border p-4 flex items-start gap-3 text-sm ${
          status.kind === "ok" ? "border-status-green/30 bg-status-green/5 text-status-green"
            : status.kind === "err" ? "border-status-red/30 bg-status-red/5 text-status-red"
            : "border-border bg-muted/40 text-foreground"
        }`}>
          {status.kind === "ok" ? <CheckCircle2 className="size-4 mt-0.5" /> :
           status.kind === "err" ? <AlertCircle className="size-4 mt-0.5" /> :
           <Loader2 className="size-4 mt-0.5 animate-spin" />}
          <span>{status.msg}</span>
        </div>
      )}

      {lastSkipped && lastSkipped.rows.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-between gap-3 text-sm">
          <div>
            <p className="font-semibold">Auditar registros ignorados</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lastSkipped.rows.length} linhas ignoradas em <span className="font-medium">{lastSkipped.filename}</span> — baixe o CSV com o motivo de cada uma.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDownloadSkipped}
            className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 text-accent px-3 py-1.5 text-xs font-semibold hover:bg-accent/20"
          >
            <Download className="size-3.5" /> Baixar ignorados
          </button>
        </div>
      )}

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">Histórico de importações</h2>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-semibold px-4 py-2.5">Data</th>
                <th className="text-left font-semibold px-4 py-2.5">Tipo</th>
                <th className="text-left font-semibold px-4 py-2.5">Arquivo</th>
                <th className="text-right font-semibold px-4 py-2.5">Novos</th>
                <th className="text-right font-semibold px-4 py-2.5">Atualizados</th>
                <th className="text-right font-semibold px-4 py-2.5">Ignorados</th>
                <th className="text-right font-semibold px-4 py-2.5">Total</th>
                <th className="text-right font-semibold px-4 py-2.5">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">Nenhuma importação registrada.</td></tr>
              )}
              {history.map((h) => (
                <tr key={h.id}>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{new Date(h.created_at).toLocaleString("pt-BR")}</td>
                  <td className="px-4 py-3">{h.kind === "receivable" ? "A Receber" : "A Pagar"}</td>
                  <td className="px-4 py-3 font-medium">{h.filename}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-status-green">{h.rows_inserted ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{h.rows_updated ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{h.rows_skipped}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{h.rows_total}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleDelete(h.id, h.filename)}
                      disabled={busy || !canWrite}
                      className="inline-flex items-center gap-1.5 rounded-md border border-status-red/30 bg-status-red/5 text-status-red px-2.5 py-1 text-xs font-medium hover:bg-status-red/10 disabled:opacity-40 disabled:pointer-events-none"
                      title="Excluir importação e seus registros"
                    >
                      <Trash2 className="size-3.5" /> Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Checagens de saúde</h2>
          <p className="text-xs text-muted-foreground">
            Roda ao fim de cada importação e diariamente às 06:00 (cron automático).
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <th className="text-left font-semibold px-4 py-2.5">Data</th>
                <th className="text-left font-semibold px-4 py-2.5">Origem</th>
                <th className="text-left font-semibold px-4 py-2.5">Arquivo</th>
                <th className="text-right font-semibold px-4 py-2.5">Novos</th>
                <th className="text-right font-semibold px-4 py-2.5">Atualizados</th>
                <th className="text-right font-semibold px-4 py-2.5">Ignorados</th>
                <th className="text-right font-semibold px-4 py-2.5">Grupos dup.</th>
                <th className="text-right font-semibold px-4 py-2.5">Linhas exced.</th>
                <th className="text-right font-semibold px-4 py-2.5">R$ duplicado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {health.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-muted-foreground">Nenhuma checagem registrada ainda.</td></tr>
              )}
              {health.map((h) => {
                const dupOk = h.duplicate_groups === 0;
                return (
                  <tr key={h.id}>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{new Date(h.checked_at).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${h.source === "import" ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"}`}>
                        {h.source === "import" ? "Importação" : "Cron diário"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{h.details?.filename ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-status-green">{h.rows_inserted ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{h.rows_updated ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{h.rows_skipped ?? "—"}</td>
                    <td className={`px-4 py-3 text-right tabular-nums font-semibold ${dupOk ? "text-status-green" : "text-status-red"}`}>{h.duplicate_groups}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${dupOk ? "text-muted-foreground" : "text-status-red"}`}>{h.duplicate_excess_rows}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${dupOk ? "text-muted-foreground" : "text-status-red"}`}>{Number(h.duplicate_excess_valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
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

function UploadCard({ label, kind, onFile, disabled }: {
  label: string; kind: "receivable" | "payable";
  onFile: (f: File, k: "receivable" | "payable") => void; disabled: boolean;
}) {
  return (
    <label className={`rounded-xl border-2 border-dashed border-border bg-card p-6 flex flex-col items-center justify-center text-center gap-3 hover:border-accent hover:bg-accent/5 transition-colors ${disabled ? "opacity-50 pointer-events-none" : "cursor-pointer"}`}>
      <div className={`size-12 rounded-full flex items-center justify-center ${kind === "receivable" ? "bg-status-green/10 text-status-green" : "bg-status-red/10 text-status-red"}`}>
        <FileSpreadsheet className="size-6" />
      </div>
      <div>
        <p className="font-semibold">{label}</p>
        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5 justify-center">
          <Upload className="size-3.5" /> Clique para selecionar um CSV
        </p>
      </div>
      <input type="file" accept=".csv,text/csv" className="hidden" disabled={disabled}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f, kind); e.target.value = ""; }}
      />
    </label>
  );
}
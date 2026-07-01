import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { seedInitialUsers } from "@/lib/users.functions";
import { Loader2, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/setup")({ component: SetupPage });

function SetupPage() {
  const seed = useServerFn(seedInitialUsers);
  const navigate = useNavigate();
  const [status, setStatus] = useState<null | { kind: "ok" | "err" | "info"; msg: string }>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true); setStatus({ kind: "info", msg: "Criando usuários iniciais…" });
    try {
      const res = await seed();
      if (res.seeded) setStatus({ kind: "ok", msg: "Usuários criados. Senha inicial: prevermed" });
      else setStatus({ kind: "info", msg: "Sistema já inicializado. Nenhuma alteração feita." });
    } catch (e) {
      setStatus({ kind: "err", msg: e instanceof Error ? e.message : "Erro no setup" });
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center">
        <div className="mx-auto size-12 rounded-full bg-accent/10 text-accent flex items-center justify-center">
          <ShieldCheck className="size-6" />
        </div>
        <h1 className="mt-4 text-xl font-display font-bold">Bootstrap inicial</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Cria os três usuários iniciais (Beatriz — admin, Bruna — operacional, Patricia — visualização). Senha padrão <code className="font-mono">prevermed</code>, com troca obrigatória no 1º acesso.
        </p>
        <button
          onClick={run} disabled={busy}
          className="mt-6 w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy && <Loader2 className="size-4 animate-spin" />} Executar setup
        </button>
        {status && (
          <div className={`mt-4 rounded-md border p-3 text-sm flex items-start gap-2 text-left ${
            status.kind === "ok" ? "border-status-green/30 bg-status-green/5 text-status-green"
            : status.kind === "err" ? "border-status-red/30 bg-status-red/5 text-status-red"
            : "border-border bg-muted/40"
          }`}>
            {status.kind === "ok" ? <CheckCircle2 className="size-4 mt-0.5" />
              : status.kind === "err" ? <AlertCircle className="size-4 mt-0.5" />
              : <Loader2 className="size-4 mt-0.5 animate-spin" />}
            <span>{status.msg}</span>
          </div>
        )}
        <button
          onClick={() => navigate({ to: "/auth" })}
          className="mt-4 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Ir para o login
        </button>
      </div>
    </div>
  );
}
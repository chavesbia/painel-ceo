import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { markPasswordChanged } from "@/lib/users.functions";
import { KeyRound, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/trocar-senha")({ component: ChangePasswordPage });

function ChangePasswordPage() {
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const mark = useServerFn(markPasswordChanged);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (pwd.length < 6) return setErr("A senha deve ter ao menos 6 caracteres.");
    if (pwd !== pwd2) return setErr("As senhas não coincidem.");
    if (pwd === "prevermed") return setErr("Escolha uma senha diferente da padrão.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    if (error) { setBusy(false); return setErr(error.message); }
    await mark();
    await qc.invalidateQueries({ queryKey: ["current-user"] });
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl border border-border bg-card p-8">
        <div className="mx-auto size-12 rounded-full bg-accent/10 text-accent flex items-center justify-center">
          <KeyRound className="size-6" />
        </div>
        <h1 className="mt-4 text-xl font-display font-bold text-center">Definir nova senha</h1>
        <p className="mt-1 text-sm text-muted-foreground text-center">Obrigatório no primeiro acesso ou após reset pelo administrador.</p>
        <div className="mt-6 space-y-3">
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Nova senha</span>
            <input type="password" value={pwd} onChange={(e)=>setPwd(e.target.value)} className="mt-1 w-full h-10 rounded-md border border-border bg-background px-3 text-sm" autoFocus required />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-muted-foreground">Confirmar</span>
            <input type="password" value={pwd2} onChange={(e)=>setPwd2(e.target.value)} className="mt-1 w-full h-10 rounded-md border border-border bg-background px-3 text-sm" required />
          </label>
        </div>
        {err && <p className="mt-3 text-sm text-status-red">{err}</p>}
        <button type="submit" disabled={busy} className="mt-5 w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
          {busy && <Loader2 className="size-4 animate-spin" />} Salvar nova senha
        </button>
      </form>
    </div>
  );
}
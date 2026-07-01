import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, LogIn } from "lucide-react";
import logoSquare from "@/assets/prevermed-logo-square.png.asset.json";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const email = `${username.trim().toLowerCase()}@prevermed.local`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setErr("Usuário ou senha inválidos."); return; }
    navigate({ to: search.redirect || "/" });
  };

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-background">
      <div className="hidden md:flex flex-col justify-between p-10 bg-primary text-primary-foreground">
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-md bg-white/95 p-1 flex items-center justify-center">
            <img src={logoSquare.url} alt="PreverMed" className="h-full w-auto" />
          </div>
          <div>
            <p className="font-display font-bold text-lg tracking-tight">PreverMed</p>
            <p className="text-[11px] uppercase tracking-[0.2em] text-white/60">Intelligence Unit</p>
          </div>
        </div>
        <div>
          <h1 className="font-display text-4xl font-bold tracking-tight">Painel do CEO</h1>
          <p className="mt-3 text-white/70 max-w-sm text-sm">Inteligência financeira consolidada do Grupo PreverMed.</p>
        </div>
        <p className="text-[11px] text-white/50">© Grupo PreverMed</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold">Acesso restrito</p>
            <h2 className="mt-1 text-2xl font-display font-bold">Entrar</h2>
            <p className="text-sm text-muted-foreground mt-1">Use seu usuário e senha corporativos.</p>
          </div>
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Usuário</span>
              <input
                type="text" autoComplete="username" required autoFocus
                value={username} onChange={(e) => setUsername(e.target.value)}
                placeholder="ex. beatriz.chaves"
                className="mt-1 w-full h-10 rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-muted-foreground">Senha</span>
              <input
                type="password" autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full h-10 rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
            </label>
          </div>
          {err && <p className="text-sm text-status-red">{err}</p>}
          <button
            type="submit" disabled={busy}
            className="w-full h-10 rounded-md bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            Entrar
          </button>
          <p className="text-[11px] text-muted-foreground text-center">Esqueceu sua senha? Solicite reset ao administrador.</p>
        </form>
      </div>
    </div>
  );
}
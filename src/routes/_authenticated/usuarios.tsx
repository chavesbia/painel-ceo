import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/app-shell";
import { supabase } from "@/integrations/supabase/client";
import { listUsers, createUser, resetUserPassword, deleteUser } from "@/lib/users.functions";
import { initials } from "@/lib/auth";
import { UserPlus, KeyRound, Trash2, Loader2, ShieldAlert, ShieldCheck, Eye, Wrench } from "lucide-react";

export const Route = createFileRoute("/_authenticated/usuarios")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
    if (!role) throw redirect({ to: "/" });
  },
  component: () => <AppShell><UsersPage /></AppShell>,
});

type Row = { id: string; username: string; full_name: string; must_change_password: boolean; created_at: string; roles: ("admin"|"operator"|"viewer")[] };

function UsersPage() {
  const list = useServerFn(listUsers);
  const create = useServerFn(createUser);
  const reset = useServerFn(resetUserPassword);
  const del = useServerFn(deleteUser);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<Row[]>({ queryKey: ["users"], queryFn: () => list() });
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["users"] });

  const handleReset = async (u: Row) => {
    if (!confirm(`Resetar senha de ${u.full_name} para "prevermed"?`)) return;
    setBusy(u.id);
    try { await reset({ data: { userId: u.id, password: "prevermed" } }); setFlash(`Senha de ${u.full_name} redefinida para "prevermed".`); }
    catch (e) { alert(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(null); refresh(); }
  };

  const handleDelete = async (u: Row) => {
    if (!confirm(`Excluir ${u.full_name}? Esta ação não pode ser desfeita.`)) return;
    setBusy(u.id);
    try { await del({ data: { userId: u.id } }); refresh(); }
    catch (e) { alert(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(null); }
  };

  const handleCreate = async (payload: { username: string; full_name: string; role: "viewer"|"operator"|"admin" }) => {
    setBusy("__new__");
    try {
      await create({ data: { ...payload, password: "prevermed" } });
      setShowNew(false);
      setFlash(`Usuário criado com senha padrão "prevermed".`);
      refresh();
    } catch (e) { alert(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(null); }
  };

  return (
    <div className="p-6 md:p-8 max-w-[1200px] mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold">Administração</p>
          <h1 className="mt-1 text-3xl md:text-4xl font-display font-bold tracking-tight">Usuários</h1>
          <p className="text-sm text-muted-foreground mt-1">Gerencie acessos, papéis e senhas do painel financeiro.</p>
        </div>
        <button onClick={() => setShowNew(true)} className="h-10 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-2">
          <UserPlus className="size-4" /> Novo usuário
        </button>
      </header>

      {flash && <div className="rounded-md border border-status-green/30 bg-status-green/5 text-status-green px-4 py-2.5 text-sm">{flash}</div>}

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <th className="text-left font-semibold px-4 py-2.5">Usuário</th>
              <th className="text-left font-semibold px-4 py-2.5">Papel</th>
              <th className="text-left font-semibold px-4 py-2.5">Status</th>
              <th className="text-right font-semibold px-4 py-2.5">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground"><Loader2 className="inline size-4 animate-spin" /> Carregando…</td></tr>}
            {(data || []).map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="size-9 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{initials(u.full_name || u.username)}</div>
                    <div>
                      <p className="font-semibold">{u.full_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{u.username}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><RoleBadges roles={u.roles} /></td>
                <td className="px-4 py-3">
                  {u.must_change_password
                    ? <span className="inline-flex items-center gap-1 text-xs text-status-yellow"><ShieldAlert className="size-3.5" /> Aguardando troca de senha</span>
                    : <span className="inline-flex items-center gap-1 text-xs text-status-green"><ShieldCheck className="size-3.5" /> Ativo</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex items-center gap-1.5">
                    <button onClick={() => handleReset(u)} disabled={busy===u.id} title="Resetar senha" className="h-8 px-2.5 rounded border border-border hover:bg-muted text-xs inline-flex items-center gap-1.5">
                      <KeyRound className="size-3.5" /> Resetar
                    </button>
                    <button onClick={() => handleDelete(u)} disabled={busy===u.id} title="Excluir" className="h-8 px-2.5 rounded border border-status-red/30 text-status-red hover:bg-status-red/5 text-xs inline-flex items-center gap-1.5">
                      <Trash2 className="size-3.5" /> Excluir
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showNew && <NewUserDialog onClose={() => setShowNew(false)} onCreate={handleCreate} busy={busy === "__new__"} />}
    </div>
  );
}

function RoleBadges({ roles }: { roles: ("admin"|"operator"|"viewer")[] }) {
  const map = { admin: { label: "Admin", cls: "bg-primary/10 text-primary", Icon: ShieldCheck },
                operator: { label: "Operacional", cls: "bg-accent/10 text-accent", Icon: Wrench },
                viewer: { label: "Visualização", cls: "bg-muted text-muted-foreground", Icon: Eye } } as const;
  return (
    <div className="flex flex-wrap gap-1.5">
      {roles.map((r) => {
        const { label, cls, Icon } = map[r];
        return <span key={r} className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cls}`}><Icon className="size-3" />{label}</span>;
      })}
    </div>
  );
}

function NewUserDialog({ onClose, onCreate, busy }: { onClose: () => void; onCreate: (p: { username: string; full_name: string; role: "viewer"|"operator"|"admin" }) => void; busy: boolean }) {
  const [full_name, setFull] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<"viewer"|"operator"|"admin">("viewer");
  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-6">
      <form onSubmit={(e)=>{e.preventDefault(); onCreate({ full_name, username, role });}} className="w-full max-w-md rounded-xl border border-border bg-card p-6 space-y-4">
        <h3 className="font-display font-bold text-lg">Novo usuário</h3>
        <label className="block"><span className="text-xs font-medium text-muted-foreground">Nome completo</span>
          <input required value={full_name} onChange={(e)=>setFull(e.target.value)} className="mt-1 w-full h-10 rounded-md border border-border bg-background px-3 text-sm" /></label>
        <label className="block"><span className="text-xs font-medium text-muted-foreground">Usuário (ex.: nome.sobrenome)</span>
          <input required pattern="[a-z0-9\.]+" value={username} onChange={(e)=>setUsername(e.target.value.toLowerCase())} className="mt-1 w-full h-10 rounded-md border border-border bg-background px-3 text-sm font-mono" /></label>
        <label className="block"><span className="text-xs font-medium text-muted-foreground">Papel</span>
          <select value={role} onChange={(e)=>setRole(e.target.value as never)} className="mt-1 w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
            <option value="viewer">Visualização (só painel)</option>
            <option value="operator">Operacional (painel + importações + saldos)</option>
            <option value="admin">Administrador (tudo + gestão de usuários)</option>
          </select></label>
        <p className="text-xs text-muted-foreground">Senha inicial: <code className="font-mono">prevermed</code> — troca obrigatória no 1º acesso.</p>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="h-9 px-3 rounded-md text-sm border border-border hover:bg-muted">Cancelar</button>
          <button type="submit" disabled={busy} className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60">
            {busy && <Loader2 className="size-3.5 animate-spin" />} Criar
          </button>
        </div>
      </form>
    </div>
  );
}
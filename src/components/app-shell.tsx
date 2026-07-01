import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Landmark,
  LineChart,
  ArrowDownCircle,
  ArrowUpCircle,
  Upload,
  Settings,
  ChevronDown,
  Users as UsersIcon,
  LogOut,
} from "lucide-react";
import logoSquare from "@/assets/prevermed-logo-square.png.asset.json";
import { useCurrentUser, initials, type AppRole } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  group: "Executivo" | "Operação" | "Sistema" | "Administração";
  disabled?: boolean;
  requires?: AppRole; // minimum role
};

const NAV: NavItem[] = [
  { to: "/", label: "Painel do CEO", icon: LayoutDashboard, group: "Executivo", requires: "viewer" },
  { to: "/saldos", label: "Saldos", icon: Landmark, group: "Operação", requires: "operator" },
  { to: "/fluxo-de-caixa", label: "Fluxo de Caixa", icon: LineChart, group: "Operação", disabled: true, requires: "operator" },
  { to: "/contas-a-pagar", label: "Contas a Pagar", icon: ArrowUpCircle, group: "Operação", disabled: true, requires: "operator" },
  { to: "/contas-a-receber", label: "Contas a Receber", icon: ArrowDownCircle, group: "Operação", disabled: true, requires: "operator" },
  { to: "/importacoes", label: "Importações", icon: Upload, group: "Sistema", requires: "operator" },
  { to: "/usuarios", label: "Usuários", icon: UsersIcon, group: "Administração", requires: "admin" },
  { to: "/configuracoes", label: "Configurações", icon: Settings, group: "Sistema", disabled: true, requires: "admin" },
];

const GROUPS: NavItem["group"][] = ["Executivo", "Operação", "Sistema", "Administração"];

function roleAllows(userRoles: AppRole[], required?: AppRole) {
  if (!required) return true;
  if (required === "viewer") return userRoles.length > 0;
  if (required === "operator") return userRoles.includes("operator") || userRoles.includes("admin");
  return userRoles.includes("admin");
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const roles = me?.roles ?? [];
  const visibleNav = NAV.filter((n) => roleAllows(roles, n.requires));
  const activeItem = visibleNav.find((n) => n.to === pathname);
  const roleLabel = me?.isAdmin ? "Administrador" : me?.isOperator ? "Operacional" : me?.isViewer ? "Visualização" : "—";

  const handleLogout = async () => {
    await supabase.auth.signOut();
    qc.clear();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen w-full flex bg-background text-foreground font-sans">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
        <div className="px-6 pt-6 pb-8">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-md bg-white/95 p-1 flex items-center justify-center shadow-sm">
              <img src={logoSquare.url} alt="PreverMed" className="h-full w-auto object-contain" />
            </div>
            <div>
              <p className="font-display font-bold text-base tracking-tight leading-none">
                Prever<span className="opacity-70 font-normal">Med</span>
              </p>
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/50 mt-1">
                Inteligência Financeira
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-6 overflow-y-auto">
          {GROUPS.filter((g) => visibleNav.some((n) => n.group === g)).map((group) => (
            <div key={group}>
              <p className="px-3 mb-2 text-[10px] uppercase tracking-[0.2em] text-white/40 font-semibold">
                {group}
              </p>
              <div className="space-y-0.5">
                {visibleNav.filter((n) => n.group === group).map((item) => {
                  const active = pathname === item.to;
                  const Icon = item.icon;
                  const cls = [
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    active
                      ? "bg-accent/15 text-accent border-l-2 border-accent -ml-[2px] pl-[10px] font-medium"
                      : item.disabled
                        ? "text-white/35 cursor-not-allowed"
                        : "text-white/70 hover:text-white hover:bg-white/5",
                  ].join(" ");
                  if (item.disabled) {
                    return (
                      <div key={item.to} className={cls} title="Disponível na próxima fase">
                        <Icon className="size-4" />
                        <span>{item.label}</span>
                        <span className="ml-auto text-[9px] uppercase tracking-wider text-white/30">Fase 2</span>
                      </div>
                    );
                  }
                  return (
                    <Link key={item.to} to={item.to} className={cls}>
                      <Icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold">
              {initials(me?.full_name || me?.username || "?")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium leading-tight truncate">{me?.full_name || "—"}</p>
              <p className="text-[11px] text-white/50 leading-tight">{roleLabel}</p>
            </div>
            <button onClick={handleLogout} title="Sair" className="p-1.5 rounded hover:bg-white/10 text-white/60 hover:text-white transition-colors">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="h-14 sticky top-0 z-20 bg-background/85 backdrop-blur border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{activeItem?.group ?? "Executivo"}</span>
            <span className="text-border">/</span>
            <span className="font-medium">{activeItem?.label ?? "Painel do CEO"}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-card text-sm hover:bg-muted transition-colors"
            >
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Empresa</span>
              <span className="font-medium">Grupo Consolidado</span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-md border border-border bg-card text-sm hover:bg-muted transition-colors"
            >
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Projeção</span>
              <span className="font-medium">30 dias</span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </button>
            <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
              {initials(me?.full_name || me?.username || "?")}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
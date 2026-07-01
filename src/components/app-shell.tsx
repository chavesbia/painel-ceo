import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Wallet,
  LineChart,
  ArrowDownCircle,
  ArrowUpCircle,
  Upload,
  Settings,
  ChevronDown,
} from "lucide-react";
import logoSquare from "@/assets/prevermed-logo-square.png.asset.json";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  group: "Executivo" | "Operação" | "Sistema";
  disabled?: boolean;
};

const NAV: NavItem[] = [
  { to: "/", label: "Painel do CEO", icon: LayoutDashboard, group: "Executivo" },
  { to: "/tesouraria", label: "Tesouraria", icon: Wallet, group: "Operação", disabled: true },
  { to: "/fluxo-de-caixa", label: "Fluxo de Caixa", icon: LineChart, group: "Operação", disabled: true },
  { to: "/contas-a-pagar", label: "Contas a Pagar", icon: ArrowUpCircle, group: "Operação", disabled: true },
  { to: "/contas-a-receber", label: "Contas a Receber", icon: ArrowDownCircle, group: "Operação", disabled: true },
  { to: "/importacoes", label: "Importações", icon: Upload, group: "Sistema" },
  { to: "/configuracoes", label: "Configurações", icon: Settings, group: "Sistema", disabled: true },
];

const GROUPS: NavItem["group"][] = ["Executivo", "Operação", "Sistema"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

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
                Intelligence Unit
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-6 overflow-y-auto">
          {GROUPS.map((group) => (
            <div key={group}>
              <p className="px-3 mb-2 text-[10px] uppercase tracking-[0.2em] text-white/40 font-semibold">
                {group}
              </p>
              <div className="space-y-0.5">
                {NAV.filter((n) => n.group === group).map((item) => {
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
              DE
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-tight">Diretoria Executiva</p>
              <p className="text-[11px] text-white/50 leading-tight">Grupo PreverMed</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header className="h-14 sticky top-0 z-20 bg-background/85 backdrop-blur border-b border-border flex items-center justify-between px-6">
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">Executivo</span>
            <span className="text-border">/</span>
            <span className="font-medium">Painel do CEO</span>
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
            <div className="hidden lg:flex flex-col items-end px-3 border-l border-border pl-4">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Última importação</span>
              <span className="text-xs font-medium tabular-nums">30/06/2026 · 07:12</span>
            </div>
            <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold">
              CE
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
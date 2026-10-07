import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Activity, Brain, Map, Bell } from "lucide-react";
import logo from "@/assets/desol-logo.svg";

const nav = [
  { to: "/", label: "Painel", icon: Activity },
  { to: "/preditivo", label: "Preditivo", icon: Brain },
  { to: "/mapa", label: "Mapa", icon: Map },
  { to: "/operacional", label: "Alertas", icon: Bell },
] as const;

function StatusBar() {
  const items = ["Rádio LoRa: Conectado (15 km)", "Modo Offline-First Ativo", "ESP32 Online"];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-good" />
          </span>
          {i}
        </span>
      ))}
    </div>
  );
}

export function AppShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-3 px-2">
          <img src={logo} alt="DeSol" className="h-9 w-9" />
          <div className="leading-tight">
            <div className="text-sm font-semibold">DeSol</div>
            <div className="text-[11px] text-muted-foreground">Telemetria Hídrica</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: true }}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
              activeProps={{ className: "bg-card !text-foreground font-medium [&>svg]:text-primary" }}
            >
              <Icon className="h-[18px] w-[18px]" />
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <main className="flex-1 px-5 pb-28 pt-6 md:px-10 md:pb-12 md:pt-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-2 flex items-center gap-2 md:hidden">
            <img src={logo} alt="DeSol" className="h-7 w-7" />
            <span className="text-sm font-semibold">DeSol</span>
          </div>
          <StatusBar />
          <h1 className="mt-4 text-[34px] font-bold leading-tight tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex justify-around border-t bg-background/80 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur-xl md:hidden">
        {nav.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            activeOptions={{ exact: true }}
            className="flex flex-col items-center gap-0.5 px-3 text-[10px] text-muted-foreground"
            activeProps={{ className: "!text-primary" }}
          >
            <Icon className="h-6 w-6" />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-3xl bg-card p-5 ${className}`}>{children}</div>;
}

export function Pill({ tone, children }: { tone: "good" | "warn" | "critical" | "water" | "primary"; children: ReactNode }) {
  const map = {
    good: "bg-good/15 text-good",
    warn: "bg-warn/15 text-warn",
    critical: "bg-critical/15 text-critical",
    water: "bg-water/15 text-water",
    primary: "bg-primary/15 text-primary",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${map[tone]}`}>{children}</span>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h2 className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{children}</h2>;
}

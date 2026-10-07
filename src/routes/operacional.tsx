import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { RefreshCw, CheckCircle2, AlertTriangle, Flame } from "lucide-react";
import { AppShell, SectionLabel } from "@/components/AppShell";
import { useAlerts, type Severity } from "@/lib/telemetry";

export const Route = createFileRoute("/operacional")({
  head: () => ({
    meta: [
      { title: "Controle operacional e alertas — DeSol" },
      { name: "description", content: "Feed de alertas por severidade e sincronização local via Bluetooth ou LoRa." },
      { property: "og:title", content: "Controle operacional e alertas — DeSol" },
      { property: "og:description", content: "Alertas e controle da rede DeSol." },
    ],
  }),
  component: Ops,
});

const filters: { key: "all" | Severity; label: string }[] = [
  { key: "all", label: "Todos" },
  { key: "good", label: "OK" },
  { key: "warn", label: "Atenção" },
  { key: "critical", label: "Crítico" },
];

const sev = {
  good: { icon: CheckCircle2, cls: "text-good bg-good/15" },
  warn: { icon: AlertTriangle, cls: "text-warn bg-warn/15" },
  critical: { icon: Flame, cls: "text-critical bg-critical/15" },
};

function Ops() {
  const alerts = useAlerts();
  const [f, setF] = useState<"all" | Severity>("all");
  const [syncing, setSyncing] = useState(false);
  const list = f === "all" ? alerts : alerts.filter((a) => a.severity === f);

  const sync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      toast.success("Sincronização concluída", { description: "214 registros enviados via LoRa · -92 dBm" });
    }, 2400);
  };

  return (
    <AppShell title="Alertas" subtitle="Controle operacional da rede">
      <button
        onClick={sync}
        disabled={syncing}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-4 font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-80 md:w-auto"
      >
        <RefreshCw className={`h-5 w-5 ${syncing ? "animate-spin" : ""}`} />
        {syncing ? "Sincronizando…" : "Forçar Sincronização Local (Bluetooth/LoRa)"}
      </button>

      <div className="mt-8 inline-flex rounded-xl bg-card p-1">
        {filters.map((x) => (
          <button
            key={x.key}
            onClick={() => setF(x.key)}
            className={`rounded-lg px-4 py-1.5 text-sm transition ${f === x.key ? "bg-elevated font-medium text-foreground shadow" : "text-muted-foreground"}`}
          >
            {x.label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        <SectionLabel>Feed de eventos</SectionLabel>
        <div className="overflow-hidden rounded-3xl bg-card">
          {list.map((a, i) => {
            const S = sev[a.severity];
            return (
              <div key={a.id} className={`flex items-center gap-4 px-5 py-3.5 animate-in fade-in slide-in-from-top-1 ${i ? "border-t" : ""}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${S.cls}`}>
                  <S.icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{a.title}</div>
                  <div className="truncate text-xs text-muted-foreground">{a.detail}</div>
                </div>
                <span className="text-xs text-muted-foreground tabular">{a.time}</span>
              </div>
            );
          })}
          {!list.length && <div className="px-5 py-8 text-center text-sm text-muted-foreground">Nenhum evento</div>}
        </div>
      </div>
    </AppShell>
  );
}

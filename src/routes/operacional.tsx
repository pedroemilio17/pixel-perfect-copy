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

  const sync = async () => {
    setSyncing(true);
    try {
      const cached = window.localStorage.getItem("desol.telemetry.latest.v1");
      const readings = cached ? [JSON.parse(cached) as Record<string, unknown>] : [];
      const response = await fetch("/api/v1/telemetry/batch-sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceId: "ESP32-DESOL-01", readings }),
      });
      const result = (await response.json()) as { accepted?: number; rejected?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Falha na sincronização");
      toast.success("Sincronização com o gateway concluída", {
        description: `${result.accepted ?? 0} leitura(s) aceitas · ${result.rejected ?? 0} rejeitada(s)`,
      });
    } catch {
      toast.error("Gateway indisponível", { description: "A leitura em cache permanece disponível neste dispositivo." });
    } finally {
      setSyncing(false);
    }
  };

  const simulateFailure = async () => {
    try {
      const response = await fetch("/api/v1/telemetry/simulate-failure", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ deviceId: "ESP32-DESOL-01" }),
      });
      const result = (await response.json()) as { sanitaryStatus?: string; recommendedLedColor?: string; reading?: { tdsValue: number } };
      if (!response.ok || !result.reading) throw new Error("Simulação indisponível");
      window.localStorage.setItem("desol.telemetry.latest.v1", JSON.stringify(result.reading));
      window.dispatchEvent(new CustomEvent("desol:telemetry-alert", { detail: result.reading }));
      toast.error("Falha simulada", { description: `${result.sanitaryStatus} · comando de LED ${result.recommendedLedColor}` });
    } catch {
      toast.error("Gateway indisponível", { description: "Não foi possível executar a simulação de falha." });
    }
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
      <button
        onClick={() => void simulateFailure()}
        className="ml-0 mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-critical/30 px-5 py-3 font-medium text-critical transition hover:bg-critical/5 md:ml-3 md:mt-0 md:inline-flex md:w-auto"
      >
        <Flame className="h-4 w-4" /> Simular falha sanitária
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

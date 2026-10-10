import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Radio, ChevronRight } from "lucide-react";
import { AppShell, Card, Pill, SectionLabel } from "@/components/AppShell";
import { communities, syncHistory } from "@/lib/telemetry";

export const Route = createFileRoute("/mapa")({
  head: () => ({
    meta: [
      { title: "Mapa e telemetria territorial — DeSol" },
      {
        name: "description",
        content:
          "Pontos de monitoramento em comunidades isoladas, sinal LoRa e histórico de sincronização offline.",
      },
      { property: "og:title", content: "Mapa e telemetria territorial — DeSol" },
      { property: "og:description", content: "Visualização territorial da rede LoRa DeSol." },
    ],
  }),
  component: MapPage,
});

const tone = (s: string) =>
  s === "online"
    ? "var(--color-good)"
    : s === "offline"
      ? "var(--color-critical)"
      : s === "sync"
        ? "var(--color-warn)"
        : "var(--color-primary)";
const label = (s: string) =>
  ({ online: "Online", offline: "Offline", sync: "Sincronizando", gateway: "Gateway" })[s] ?? s;

function MapPage() {
  const [sel, setSel] = useState<string>("a");
  const node = communities.find((c) => c.id === sel)!;
  const gw = communities.find((c) => c.id === "f")!;
  return (
    <AppShell title="Mapa" subtitle="Semiárido · 6 pontos de monitoramento">
      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        <Card className="p-2">
          <svg viewBox="0 0 100 90" className="w-full rounded-[1.25rem] bg-elevated">
            {[0, 1, 2, 3].map((i) => (
              <path
                key={i}
                d={`M0 ${15 + i * 22} Q 25 ${5 + i * 22} 50 ${18 + i * 22} T 100 ${12 + i * 22}`}
                fill="none"
                stroke="var(--color-border)"
                strokeWidth="0.4"
              />
            ))}
            <path
              d="M-2 80 C 20 70, 30 85, 55 75 S 85 60, 102 66"
              fill="none"
              stroke="var(--color-water)"
              strokeOpacity="0.5"
              strokeWidth="1.2"
            />
            <circle
              cx={gw.x}
              cy={gw.y}
              r="34"
              fill="var(--color-primary)"
              fillOpacity="0.04"
              stroke="var(--color-primary)"
              strokeOpacity="0.2"
              strokeDasharray="1 1.5"
              strokeWidth="0.3"
            />
            {communities
              .filter((c) => c.id !== "f")
              .map((c) => (
                <line
                  key={c.id}
                  x1={gw.x}
                  y1={gw.y}
                  x2={c.x}
                  y2={c.y}
                  stroke={tone(c.status)}
                  strokeOpacity="0.35"
                  strokeWidth="0.35"
                  strokeDasharray={c.status === "offline" ? "1 1" : undefined}
                />
              ))}
            {communities.map((c) => (
              <g key={c.id} onClick={() => setSel(c.id)} className="cursor-pointer">
                {sel === c.id && (
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r="4.5"
                    fill={tone(c.status)}
                    fillOpacity="0.2"
                    className="animate-pulse"
                  />
                )}
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={c.id === "f" ? 2.4 : 1.8}
                  fill={tone(c.status)}
                  stroke="var(--color-background)"
                  strokeWidth="0.5"
                />
                <text
                  x={c.x}
                  y={c.y - 3.5}
                  textAnchor="middle"
                  fontSize="2.6"
                  fill="var(--color-foreground)"
                  opacity={sel === c.id ? 1 : 0.6}
                >
                  {c.name}
                </text>
              </g>
            ))}
          </svg>
        </Card>

        <div className="space-y-3">
          <Card>
            <div className="flex items-center justify-between">
              <span className="font-semibold">{node.name}</span>
              <span className="text-xs font-medium" style={{ color: tone(node.status) }}>
                {label(node.status)}
              </span>
            </div>
            <div className="mt-4 flex items-end gap-3">
              <Radio className="mb-1 h-5 w-5 text-primary" />
              <span className="text-4xl font-semibold tracking-tight tabular">{node.dbm}</span>
              <span className="mb-1 text-sm text-muted-foreground">dBm</span>
            </div>
            <div className="mt-4 divide-y text-sm">
              <Row k="Última sincronização" v={node.sync} />
              <Row k="Produção hoje" v={node.liters ? `${node.liters} L` : "—"} />
              <Row
                k="Distância do gateway"
                v={`${(Math.hypot(node.x - gw.x, node.y - gw.y) * 0.45).toFixed(1)} km`}
              />
            </div>
          </Card>
          <div className="flex gap-2">
            <Pill tone="good">4 online</Pill>
            <Pill tone="critical">1 offline</Pill>
            <Pill tone="warn">1 em sync</Pill>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <SectionLabel>Histórico de sincronização offline</SectionLabel>
        <div className="overflow-hidden rounded-3xl bg-card">
          {syncHistory.map((s, i) => (
            <div key={i} className={`flex items-center gap-4 px-5 py-3.5 ${i ? "border-t" : ""}`}>
              <span className="w-12 text-sm text-muted-foreground tabular">{s.time}</span>
              <div className="flex-1">
                <div className="text-sm">{s.node}</div>
                <div className="text-xs text-muted-foreground">
                  {s.packets} pacotes · {s.mode}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-2.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="tabular">{v}</span>
    </div>
  );
}

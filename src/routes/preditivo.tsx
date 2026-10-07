import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Sun, Wind, ThermometerSun, CheckCircle2 } from "lucide-react";
import { AppShell, Card, Pill, SectionLabel } from "@/components/AppShell";

export const Route = createFileRoute("/preditivo")({
  head: () => ({
    meta: [
      { title: "MÃ³dulo preditivo PIML â€” DeSol" },
      { name: "description", content: "Estimativa demonstrativa de produÃ§Ã£o de Ã¡gua baseada em modelo fÃ­sico de Dunkle." },
      { property: "og:title", content: "MÃ³dulo preditivo PIML â€” DeSol" },
      { property: "og:description", content: "Estimativa demonstrativa de produÃ§Ã£o baseada em modelo fÃ­sico de Dunkle." },
    ],
  }),
  component: Predictive,
});

const components = [
  { name: "EficiÃªncia do condensador", value: 98 },
  { name: "VedaÃ§Ã£o da cobertura de vidro", value: 94 },
  { name: "Bomba de recirculaÃ§Ã£o", value: 89 },
  { name: "Sensor TDS (calibraÃ§Ã£o)", value: 76 },
];

function Gauge({ value, max }: { value: number; max: number }) {
  const r = 80;
  const c = Math.PI * r;
  const pct = value / max;
  return (
    <svg viewBox="0 0 200 115" className="w-full max-w-[260px]">
      <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="var(--color-muted)" strokeWidth="14" strokeLinecap="round" />
      <path
        d="M20 100 A80 80 0 0 1 180 100"
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        style={{ transition: "stroke-dashoffset 1s ease" }}
      />
      <text x="100" y="88" textAnchor="middle" fill="var(--color-foreground)" fontSize="34" fontWeight="600">
        {value.toFixed(1)}
      </text>
      <text x="100" y="108" textAnchor="middle" fill="var(--color-muted-foreground)" fontSize="11">
        litros previstos
      </text>
    </svg>
  );
}

function Predictive() {
  const [prediction, setPrediction] = useState<{ predictedYieldLiters: number; calibrated: boolean } | null>(null);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/v1/predictions/daily-yield/ESP32-DESOL-01", { cache: "no-store" });
        if (!response.ok) return;
        const result = (await response.json()) as { predictedYieldLiters: number; calibrated: boolean };
        if (active) setPrediction(result);
      } catch {
        // Keep the empty state while the gateway is unavailable.
      }
    };
    void refresh();
    const id = window.setInterval(() => void refresh(), 30_000);
    return () => { active = false; window.clearInterval(id); };
  }, []);
  return (
    <AppShell title="Preditivo" subtitle="Physics-Informed Machine Learning (PIML)">
      <div
        className="rounded-3xl p-6"
        style={{ background: "linear-gradient(135deg, color-mix(in oklab, var(--color-primary) 22%, var(--color-card)), var(--color-card) 60%)" }}
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" /> Estado do modelo
        </div>
        <div className="mt-2 text-4xl font-bold tracking-tight">Estimativa fÃ­sica</div>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Modelo demonstrativo baseado na relaÃ§Ã£o de Dunkle. Ainda sem calibraÃ§Ã£o com dados de campo.
        </p>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <Card className="flex flex-col items-center text-center">
          <div className="self-start text-sm text-muted-foreground">PrevisÃ£o de ProduÃ§Ã£o de AmanhÃ£</div>
          <div className="my-4"><Gauge value={prediction?.predictedYieldLiters ?? 0} max={30} /></div>
          {!prediction && <p className="text-xs text-muted-foreground">Aguardando uma leitura do gateway</p>}
          <Pill tone="good">+17% sobre hoje</Pill>
          <div className="mt-5 grid w-full grid-cols-3 gap-2 text-left">
            {[
              { icon: Sun, label: "RadiaÃ§Ã£o", v: "6,2 kWh/mÂ²" },
              { icon: ThermometerSun, label: "MÃ¡x. ambiente", v: "34 Â°C" },
              { icon: Wind, label: "Vento", v: "11 km/h" },
            ].map(({ icon: I, label, v }) => (
              <div key={label} className="rounded-2xl bg-elevated p-3">
                <I className="h-4 w-4 text-primary" />
                <div className="mt-2 text-[11px] text-muted-foreground">{label}</div>
                <div className="text-sm font-medium">{v}</div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Baseado no modelo fÃ­sico de Dunkle e radiaÃ§Ã£o solar local.</p>
        </Card>

        <div>
          <SectionLabel>ManutenÃ§Ã£o preditiva</SectionLabel>
          <div className="overflow-hidden rounded-3xl bg-card">
            {components.map((c, i) => (
              <div key={c.name} className={`px-5 py-4 ${i ? "border-t" : ""}`}>
                <div className="flex justify-between text-sm">
                  <span>{c.name}</span>
                  <span className="tabular text-muted-foreground">{c.value}%</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className={`h-full rounded-full ${c.value > 85 ? "bg-good" : "bg-warn"}`} style={{ width: `${c.value}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-start gap-3 rounded-3xl bg-good/10 p-4 text-sm">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-good" />
            <span>Nenhuma manutenÃ§Ã£o necessÃ¡ria nos prÃ³ximos 15 dias. Recalibrar sensor TDS em 22 dias.</span>
          </div>
        </div>
      </div>
    </AppShell>
  );
}


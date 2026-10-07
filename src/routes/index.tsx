import { createFileRoute } from "@tanstack/react-router";
import { Droplets, Thermometer, Container, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { AppShell, Card, Pill, SectionLabel } from "@/components/AppShell";
import { useTelemetry, useTelemetryHistory } from "@/lib/telemetry";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Painel em tempo real â€” DeSol" },
      { name: "description", content: "Salinidade, temperatura, reservatÃ³rio e produÃ§Ã£o de Ã¡gua do dessalinizador solar DeSol em tempo real." },
      { property: "og:title", content: "Painel em tempo real â€” DeSol" },
      { property: "og:description", content: "Telemetria hÃ­drica inteligente ao vivo via LoRa e ESP32." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const t = useTelemetry();
  const history24h = useTelemetryHistory();
  const liters = ((t.level / 100) * 50).toFixed(1);
  return (
    <AppShell title="Painel" subtitle="Leituras ao vivo do mÃ³dulo DeSol #01">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Head icon={<Droplets className="h-4 w-4" />} color="text-water" label="Salinidade / TDS" />
          <Value v={t.tds} unit="ppm" />
          <Pill tone={t.led === "RED" ? "critical" : t.led === "YELLOW" ? "warn" : "good"}>{t.status.replaceAll("_", " ")}</Pill>
          {t.offline && <p className="mt-2 text-xs text-muted-foreground">Modo offline Â· Ãºltima leitura em cache</p>}
        </Card>
        <Card>
          <Head icon={<Thermometer className="h-4 w-4" />} color="text-warn" label="Temperatura" />
          <Value v={t.temp.toFixed(1)} unit="Â°C" />
          <Pill tone="warn">Faixa ideal 50â€“60 Â°C</Pill>
        </Card>
        <Card>
          <Head icon={<Container className="h-4 w-4" />} color="text-water" label="ReservatÃ³rio" />
          <Value v={Math.round(t.level)} unit="%" />
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-water transition-all duration-700" style={{ width: `${t.level}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground tabular">{liters} L / 50 L</p>
        </Card>
        <Card>
          <Head icon={<TrendingUp className="h-4 w-4" />} color="text-primary" label="ProduÃ§Ã£o" />
          <Value v={t.production.toFixed(1)} unit="L/dia" />
          <Pill tone="good">+12% vs. ontem</Pill>
        </Card>
      </div>

      <div className="mt-8">
        <SectionLabel>Ãšltimas 24 horas</SectionLabel>
        <Card className="pt-6">
          <div className="h-72">
            <ResponsiveContainer>
              <LineChart data={history24h} margin={{ left: -16, right: -8 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="hora" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} interval={3} />
                <YAxis yAxisId="t" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis yAxisId="p" orientation="right" stroke="var(--color-muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ background: "var(--color-elevated)", border: "none", borderRadius: 14, fontSize: 12 }}
                  labelStyle={{ color: "var(--color-muted-foreground)" }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="t" type="monotone" dataKey="temperatura" name="Temperatura (Â°C)" stroke="var(--color-warn)" strokeWidth={2.5} dot={false} />
                <Line yAxisId="p" type="monotone" dataKey="producao" name="ProduÃ§Ã£o (L)" stroke="var(--color-water)" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function Head({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className={color}>{icon}</span>
      {label}
    </div>
  );
}

function Value({ v, unit }: { v: string | number; unit: string }) {
  return (
    <div className="my-3 flex items-baseline gap-1">
      <span className="text-4xl font-semibold tracking-tight tabular">{v}</span>
      <span className="text-sm text-muted-foreground">{unit}</span>
    </div>
  );
}


import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import { Card } from "@/components/AppShell";
import { useTelemetry, useTelemetryHistory } from "@/lib/telemetry";

export default function LegacyTelemetryPanel() {
  const telemetry = useTelemetry();
  const history = useTelemetryHistory();
  return (
    <div className="dt-legacy-content">
      <p>
        Integração anterior: ESP32-DESOL-01.{" "}
        {telemetry.offline
          ? "API sem conexão confirmada: valores de referência ou último cache; não indicam operação atual."
          : "Leitura recebida da API anterior."}{" "}
        Essas métricas não são convertidas em nível (mm) ou vazão (L/h) dos sensores r33.
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Salinidade / TDS", telemetry.tds, "ppm"],
          ["Temperatura", telemetry.temp.toFixed(1), "°C"],
          ["Reservatório", Math.round(telemetry.level), "%"],
          ["Produção acumulada", telemetry.production.toFixed(1), "L"],
        ].map(([label, value, unit]) => (
          <Card key={label}>
            <div className="text-xs text-muted-foreground">{label}</div>
            <div className="mt-3 text-2xl font-semibold">
              {value} <small className="text-xs text-muted-foreground">{unit}</small>
            </div>
          </Card>
        ))}
      </div>
      <div className="mt-5 h-72">
        <ResponsiveContainer>
          <LineChart data={history}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="hora" fontSize={11} stroke="var(--color-muted-foreground)" />
            <YAxis yAxisId="temperature" fontSize={11} stroke="var(--color-muted-foreground)" />
            <YAxis
              yAxisId="production"
              orientation="right"
              fontSize={11}
              stroke="var(--color-muted-foreground)"
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-elevated)",
                border: "none",
                borderRadius: 12,
              }}
            />
            <Legend />
            <Line
              yAxisId="temperature"
              dataKey="temperatura"
              name="Temperatura (°C)"
              stroke="var(--color-warn)"
              dot={false}
            />
            <Line
              yAxisId="production"
              dataKey="producao"
              name="Produção acumulada (L)"
              stroke="var(--color-water)"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p>
        O histórico legado pode usar uma série ilustrativa quando não há dados na API. Nenhum
        diagnóstico de potabilidade é derivado desse painel.
      </p>
    </div>
  );
}

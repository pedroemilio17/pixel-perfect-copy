import { z } from "zod";
import manifest from "./data/model-manifest.json";
import fixture from "./data/demo.json";

export const sensorIds = ["solar_irradiance", "water_level", "production_flow", "gateway"] as const;
export type SensorId = (typeof sensorIds)[number];
export type Health = "ok" | "stale" | "offline" | "error" | "unknown";
export const healthLabels: Record<Health, string> = {
  ok: "Leitura atualizada",
  stale: "Leitura atrasada",
  offline: "Comunicação offline",
  error: "Erro de leitura",
  unknown: "Estado desconhecido",
};
export const sensors = {
  solar_irradiance: {
    label: "Irradiância solar",
    shortLabel: "Irradiância",
    metric: "irradiance_w_m2",
    unit: "W/m²",
    description:
      "Energia solar incidente medida pelo piranômetro. A presença do sensor no modelo não confirma sua instalação física.",
  },
  water_level: {
    label: "Nível de água",
    shortLabel: "Nível de água",
    metric: "water_level_mm",
    unit: "mm",
    description:
      "Altura da lâmina de água. O local físico da medição, na cuba ou no reservatório, deve ser confirmado na instalação.",
  },
  production_flow: {
    label: "Vazão de água produzida",
    shortLabel: "Vazão produzida",
    metric: "production_flow_l_h",
    unit: "L/h",
    description:
      "Vazão na saída do dessalinizador. Volume acumulado exige integração de leituras válidas ao longo do tempo.",
  },
  gateway: {
    label: "Controlador ESP32 / LoRa",
    shortLabel: "Gateway ESP32 / LoRa",
    metric: "gateway_online",
    unit: "boolean",
    description:
      "Comunicação reportada pelo backend. A antena e o indicador 3D não comprovam conectividade do equipamento.",
  },
} satisfies Record<
  SensorId,
  { label: string; shortLabel: string; metric: string; unit: string; description: string }
>;

export const parts = {
  roof: {
    label: "Cobertura de vidro",
    description:
      "Tampa translúcida inclinada a 18°, com moldura vedada. A condensação na superfície conduz a água para a calha.",
  },
  basin_and_gutter: {
    label: "Cuba, água e calha",
    description:
      "Cuba preta junto à carcaça. Lâmina conceitual de 40 mm e calha contínua na parede menor +X: 0,186 m × 1,236 m, com dreno ligado à saída.",
  },
  solar_panel: {
    label: "Painel fotovoltaico",
    description:
      "Conjunto de alimentação solar. Tensão, corrente e bateria só poderão ser monitoradas se essas medições estiverem disponíveis.",
  },
  external_tank: {
    label: "Reservatório externo",
    description:
      "Reservatório lateral para alimentação de água. Capacidade e posição física dos sensores devem ser confirmadas.",
  },
  cooling: {
    label: "Circuito de resfriamento",
    description: "Tubulação de alimentação e tubo perfurado superior de resfriamento da cobertura.",
  },
  electronics: {
    label: "Eletrônica e comunicação",
    description:
      "Caixa IP65, controlador ESP32 e antena LoRa. A comunicação depende de gateway e protocolo efetivamente configurados.",
  },
  collection_and_filter: {
    label: "Saída e filtro mineralizador",
    description:
      "Saída hidráulica ligada à calha e filtro cilíndrico de calcita. O modelo não atesta potabilidade ou qualidade sanitária da água.",
  },
  body: {
    label: "Carcaça e isolamento",
    description:
      "Corpo branco fechado com base preta. Dimensões conceituais: 1,66 m × 1,24 m; não são cotas de fabricação.",
  },
} as const;
export type PartId = keyof typeof parts;
export type ComponentId = SensorId | PartId;
export function isSensor(id: ComponentId): id is SensorId {
  return sensorIds.includes(id as SensorId);
}

export function componentFromName(name: string): ComponentId | undefined {
  for (const sensor of manifest.sensorRoles) {
    if (
      sensor.sceneObjectNames.includes(name) ||
      sensor.sceneGroupPrefixes.some((prefix) => name.startsWith(prefix))
    )
      return sensor.id as SensorId;
  }
  for (const part of manifest.otherInteractiveParts) {
    if (part.prefixes.some((prefix) => name.startsWith(prefix))) return part.group as PartId;
  }
  return undefined;
}
export type NamedObject = { name: string; parent?: NamedObject | null };
export function componentFromObject(object: NamedObject): ComponentId | undefined {
  let candidate: ComponentId | undefined;
  let node: NamedObject | null | undefined = object;
  while (node) {
    const id = componentFromName(node.name);
    if (id && isSensor(id)) return id;
    candidate ??= id;
    node = node.parent;
  }
  return candidate;
}
export function inspectSceneNames(names: string[]) {
  const found = new Set(
    names.map(componentFromName).filter((id): id is ComponentId => id !== undefined),
  );
  const missingNames = manifest.sensorRoles
    .flatMap((sensor) => sensor.sceneObjectNames)
    .filter(
      (expected) =>
        !names.some(
          (name) =>
            name === expected || name.startsWith(`${expected}_`) || name.startsWith(`${expected}.`),
        ),
    );
  return { found: [...found], missingNames, objectCount: names.length };
}

export const telemetrySchema = z
  .object({
    deviceId: z.string().trim().min(1),
    sensorId: z.enum(sensorIds),
    metric: z.string(),
    value: z.union([z.number().finite(), z.boolean(), z.null()]),
    unit: z.string(),
    timestamp: z.string().datetime({ offset: true }),
    quality: z.enum(["good", "suspect", "bad", "missing"]),
    source: z.enum(["demo", "real"]),
    diagnosticCode: z.string().nullable().optional(),
    rssiDbm: z.number().int().nullable().optional(),
    batteryPct: z.number().min(0).max(100).nullable().optional(),
  })
  .superRefine((reading, ctx) => {
    const sensor = sensors[reading.sensorId];
    if (reading.metric !== sensor.metric || reading.unit !== sensor.unit)
      ctx.addIssue({ code: "custom", message: "Métrica ou unidade incompatível com o sensor" });
    if (
      reading.value !== null &&
      (reading.sensorId === "gateway"
        ? typeof reading.value !== "boolean"
        : typeof reading.value !== "number")
    )
      ctx.addIssue({ code: "custom", message: "Tipo de valor incompatível com o sensor" });
  });
export type Reading = z.infer<typeof telemetrySchema>;
export const eventSchema = z.object({
  id: z.string(),
  timestamp: z.string().datetime({ offset: true }),
  sensorId: z.enum(sensorIds).nullable().optional(),
  severity: z.enum(["info", "warning", "error"]),
  message: z.string(),
  source: z.enum(["demo", "real"]),
});
export type TelemetryEvent = z.infer<typeof eventSchema>;
export const summarySchema = z.object({
  deviceId: z.string(),
  hardwareConfirmed: z.boolean().default(false),
  communication: z.enum(["online", "offline", "unknown"]).default("unknown"),
  lastSeen: z.string().datetime({ offset: true }).nullable().optional(),
  sampleIntervalSeconds: z.number().positive().optional(),
});
export type Summary = z.infer<typeof summarySchema>;

export function calculateHealth(
  reading: Reading | undefined,
  now: number,
  intervalSeconds?: number,
  hardwareConfirmed = false,
  explicitlyOffline = false,
): Health {
  if (reading?.source === "demo") return "unknown";
  if (explicitlyOffline) return "offline";
  if (!reading || reading.source !== "real") return "unknown";
  if (reading.quality === "bad" || reading.diagnosticCode) return "error";
  if (
    reading.value === null ||
    reading.quality !== "good" ||
    !hardwareConfirmed ||
    !intervalSeconds ||
    !Number.isFinite(intervalSeconds) ||
    intervalSeconds <= 0
  )
    return "unknown";
  const age = now - Date.parse(reading.timestamp);
  if (!Number.isFinite(age) || age < -60_000) return "unknown";
  if (age > intervalSeconds * 2_000) return "stale";
  return reading.sensorId === "gateway" && reading.value === false ? "offline" : "ok";
}
export function latestBySensor(records: Reading[]) {
  const latest: Partial<Record<SensorId, Reading>> = {};
  for (const reading of records) {
    if (
      !latest[reading.sensorId] ||
      Date.parse(reading.timestamp) > Date.parse(latest[reading.sensorId]!.timestamp)
    )
      latest[reading.sensorId] = reading;
  }
  return latest;
}

export const demoRecords = telemetrySchema.array().parse(fixture.records);
export const demoHistory: Reading[] = fixture.history
  .flatMap((sample) =>
    sensorIds
      .filter((id) => id !== "gateway")
      .map((sensorId) =>
        telemetrySchema.parse({
          deviceId: fixture.deviceId,
          sensorId,
          metric: sensors[sensorId].metric,
          value: sample[sensors[sensorId].metric as keyof typeof sample],
          unit: sensors[sensorId].unit,
          timestamp: sample.timestamp,
          source: "demo",
          quality: "good",
        }),
      ),
  )
  .concat(demoRecords.filter((r) => r.sensorId === "gateway"));
export const demoEvents: TelemetryEvent[] = [
  {
    id: "demo-fixture",
    timestamp: "2026-10-09T12:00:00Z",
    severity: "info",
    source: "demo",
    message: "Conjunto de demonstração carregado. Nenhum evento de hardware real foi recebido.",
  },
];

export type DemoScenario = "nominal" | "gateway-offline" | "bad-reading";
export function demoSnapshot(scenario: DemoScenario) {
  if (scenario === "nominal")
    return { records: demoRecords, history: demoHistory, events: demoEvents };
  const timestamp = "2026-10-09T13:01:00Z";
  const sensorId = scenario === "gateway-offline" ? "gateway" : "solar_irradiance";
  const simulated: Reading = {
    ...demoRecords.find((record) => record.sensorId === sensorId)!,
    timestamp,
    value: scenario === "gateway-offline" ? false : null,
    quality: scenario === "gateway-offline" ? "good" : "bad",
    diagnosticCode: scenario === "gateway-offline" ? null : "DEMO_INVALID_READING",
  };
  const event: TelemetryEvent = {
    id: `demo-${scenario}`,
    timestamp,
    sensorId,
    severity: scenario === "gateway-offline" ? "warning" : "error",
    source: "demo",
    message:
      scenario === "gateway-offline"
        ? "Simulação: comunicação do gateway interrompida. Não representa uma falha física real."
        : "Simulação: leitura inválida do piranômetro. Nenhum limite de segurança foi presumido.",
  };
  return {
    records: demoRecords.filter((record) => record.sensorId !== sensorId).concat(simulated),
    history: demoHistory.concat(simulated),
    events: demoEvents.concat(event),
  };
}

export function filterRecords(
  records: Reading[],
  sensor: SensorId | "all",
  from: number,
  to: number,
) {
  return records
    .filter(
      (r) =>
        (sensor === "all" || r.sensorId === sensor) &&
        Date.parse(r.timestamp) >= from &&
        Date.parse(r.timestamp) <= to,
    )
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
}
export function historyPoints(records: Reading[], sensorId: SensorId, intervalSeconds?: number) {
  const samples = records
    .filter((r) => r.sensorId === sensorId)
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
  const points: { timestamp: number; value: number | null; gap?: boolean }[] = [];
  let gaps = 0;
  for (const sample of samples) {
    const timestamp = Date.parse(sample.timestamp);
    const previous = points.at(-1);
    if (previous && intervalSeconds && timestamp - previous.timestamp > intervalSeconds * 2_000) {
      points.push({
        timestamp: previous.timestamp + intervalSeconds * 1_000,
        value: null,
        gap: true,
      });
      gaps++;
    }
    points.push({
      timestamp,
      value:
        sample.quality === "good" && typeof sample.value === "number"
          ? sample.value
          : sample.quality === "good" && typeof sample.value === "boolean"
            ? Number(sample.value)
            : null,
    });
  }
  return { points, gaps };
}
function csvCell(value: unknown): string {
  const text = String(value ?? "");
  // Prevent spreadsheet formulas in backend-provided text fields.
  const safe =
    /^[=+@\t\r]/.test(text) || (/^-/.test(text) && !/^-\d+(\.\d+)?$/.test(text))
      ? `'${text}`
      : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function recordsToCsv(records: Reading[]) {
  const fields = [
    "deviceId",
    "sensorId",
    "metric",
    "value",
    "unit",
    "timestamp",
    "quality",
    "source",
    "diagnosticCode",
    "rssiDbm",
    "batteryPct",
  ] as const;
  return (
    "\ufeff" +
    [
      fields.join(","),
      ...records.map((record) => fields.map((key) => csvCell(record[key])).join(",")),
    ].join("\r\n")
  );
}
export function formatTimestamp(timestamp: string | number | undefined | null) {
  return timestamp == null
    ? "Sem leitura"
    : new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Cuiaba",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(timestamp));
}
export function formatValue(reading?: Reading) {
  if (!reading || reading.value === null) return "—";
  if (typeof reading.value === "boolean") return reading.value ? "Conectado" : "Desconectado";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(reading.value);
}
export const modelManifest = manifest;

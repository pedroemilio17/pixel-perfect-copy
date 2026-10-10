import { z } from "zod";
import {
  eventSchema,
  summarySchema,
  telemetrySchema,
  type Reading,
  type TelemetryEvent,
} from "./model";

const configSchema = z.object({
  mode: z.enum(["demo", "real"]),
  deviceId: z.string().min(1),
  sampleIntervalSeconds: z.number().positive().optional(),
});
export type TelemetryConfig = z.infer<typeof configSchema>;
export async function fetchJson(path: string, signal?: AbortSignal) {
  const timeout = AbortSignal.timeout(8_000);
  const response = await fetch(path, {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(`API respondeu HTTP ${response.status}`);
  return response.json() as Promise<unknown>;
}
export async function loadConfig(signal?: AbortSignal) {
  return configSchema.parse(await fetchJson("/api/digital-twin/config", signal));
}
function parseReadings(payload: unknown, deviceId: string): Reading[] {
  const records = telemetrySchema
    .array()
    .parse(
      Array.isArray(payload)
        ? payload
        : z.object({ records: telemetrySchema.array() }).parse(payload).records,
    );
  if (records.some((r) => r.source !== "real" || r.deviceId !== deviceId))
    throw new Error("A API retornou dados de outra origem ou dispositivo");
  return records;
}
export async function loadSnapshot(
  config: TelemetryConfig,
  from: string,
  to: string,
  signal: AbortSignal,
) {
  const query = new URLSearchParams({ from, to });
  const [latest, history, eventsPayload, summaryPayload] = await Promise.all([
    fetchJson("/api/digital-twin/latest", signal),
    fetchJson(`/api/digital-twin/history?${query}`, signal),
    fetchJson(`/api/digital-twin/events?${query}`, signal),
    fetchJson("/api/digital-twin/summary", signal),
  ]);
  const events: TelemetryEvent[] = eventSchema
    .array()
    .parse(
      Array.isArray(eventsPayload)
        ? eventsPayload
        : z.object({ events: eventSchema.array() }).parse(eventsPayload).events,
    );
  if (events.some((event) => event.source !== "real"))
    throw new Error("A API retornou eventos simulados no modo real");
  const summary = summarySchema.parse(summaryPayload);
  if (summary.deviceId !== config.deviceId) throw new Error("Resumo de outro dispositivo");
  return {
    records: parseReadings(latest, config.deviceId),
    history: parseReadings(history, config.deviceId),
    events,
    summary,
  };
}

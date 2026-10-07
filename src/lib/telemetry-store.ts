import { z } from "zod";

export const telemetryReadingSchema = z.object({
  deviceId: z.string().trim().min(1).max(100),
  timestamp: z.number().finite().nonnegative(),
  waterTemp: z.number().finite().min(-20).max(150),
  glassTemp: z.number().finite().min(-20).max(120),
  tdsValue: z.number().finite().min(0).max(100_000),
  reservoirLevel: z.number().finite().min(0).max(100),
  accumulatedYield: z.number().finite().min(0).max(1_000_000),
  solarIrradiation: z.number().finite().min(0).max(2_000),
  rssiLoRa: z.number().finite().min(-200).max(0),
  batteryLevel: z.number().finite().min(0).max(100),
});

export type TelemetryReading = z.infer<typeof telemetryReadingSchema>;
export type SanitaryStatus = "CRITICO_CONTAMINACAO" | "ATENCAO_SALINIDADE" | "POTAVEL_EXCELENTE";
export type LedColor = "RED" | "YELLOW" | "GREEN";

export type IngestResult = {
  success: true;
  sanitaryStatus: SanitaryStatus;
  recommendedLedColor: LedColor;
  alertTriggered: boolean;
};

export function classifyReading(reading: TelemetryReading): IngestResult {
  if (reading.tdsValue > 100 || reading.waterTemp > 70) {
    return { success: true, sanitaryStatus: "CRITICO_CONTAMINACAO", recommendedLedColor: "RED", alertTriggered: true };
  }
  if (reading.reservoirLevel > 95) {
    return { success: true, sanitaryStatus: "ATENCAO_SALINIDADE", recommendedLedColor: "YELLOW", alertTriggered: false };
  }
  return { success: true, sanitaryStatus: "POTAVEL_EXCELENTE", recommendedLedColor: "GREEN", alertTriggered: false };
}

const HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_READINGS_PER_DEVICE = 10_000;
const readingsByDevice = new Map<string, TelemetryReading[]>();

function prune(readings: TelemetryReading[], nowSeconds: number): TelemetryReading[] {
  return readings
    .filter((reading) => reading.timestamp >= nowSeconds - HISTORY_WINDOW_MS / 1000)
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-MAX_READINGS_PER_DEVICE);
}

export function addReading(reading: TelemetryReading): void {
  const readings = readingsByDevice.get(reading.deviceId) ?? [];
  const existingIndex = readings.findIndex((item) => item.timestamp === reading.timestamp);
  if (existingIndex >= 0) readings[existingIndex] = reading;
  else readings.push(reading);
  readingsByDevice.set(reading.deviceId, prune(readings, Date.now() / 1000));
}

export function addReadingsBatch(deviceId: string, candidates: unknown[]): { accepted: number; rejected: number } {
  let accepted = 0;
  let rejected = 0;
  const parsed: TelemetryReading[] = [];
  for (const candidate of candidates) {
    const result = telemetryReadingSchema.safeParse(candidate);
    if (!result.success || result.data.deviceId !== deviceId) {
      rejected += 1;
      continue;
    }
    parsed.push(result.data);
  }
  parsed.sort((a, b) => a.timestamp - b.timestamp);
  for (const reading of parsed) {
    addReading(reading);
    accepted += 1;
  }
  return { accepted, rejected };
}

export function getLatestReading(deviceId: string): TelemetryReading | undefined {
  const readings = readingsByDevice.get(deviceId);
  return readings?.[readings.length - 1];
}

export function getReadings24h(deviceId: string): TelemetryReading[] {
  const readings = readingsByDevice.get(deviceId) ?? [];
  const current = prune(readings, Date.now() / 1000);
  readingsByDevice.set(deviceId, current);
  return current;
}

export function getDeviceStatus(deviceId: string) {
  const latest = getLatestReading(deviceId);
  const ageSeconds = latest ? Math.max(0, Date.now() / 1000 - latest.timestamp) : null;
  return {
    deviceId,
    status: ageSeconds !== null && ageSeconds <= 300 ? "online" : "offline",
    lastSeen: latest?.timestamp ?? null,
    ageSeconds: ageSeconds === null ? null : Math.round(ageSeconds),
    recommendedLedColor: latest ? classifyReading(latest).recommendedLedColor : null,
  };
}


import { useEffect, useState } from "react";
import type { TelemetryReading } from "./telemetry-store";

const DEVICE_ID = "ESP32-DESOL-01";
const CACHE_KEY = "desol.telemetry.latest.v1";
const HISTORY_CACHE_KEY = "desol.telemetry.history.v1";

export type Telemetry = {
  tds: number;
  temp: number;
  level: number;
  production: number;
  status: string;
  led: "RED" | "YELLOW" | "GREEN";
  offline: boolean;
};

const demoReading: TelemetryReading = {
  deviceId: DEVICE_ID,
  timestamp: Date.now() / 1000,
  waterTemp: 54.2,
  glassTemp: 32.8,
  tdsValue: 88,
  reservoirLevel: 82,
  accumulatedYield: 18.4,
  solarIrradiation: 850.5,
  rssiLoRa: -92,
  batteryLevel: 4.15,
};

function cachedReading(): TelemetryReading {
  if (typeof window === "undefined") return demoReading;
  try {
    const saved = window.localStorage.getItem(CACHE_KEY);
    if (saved) return { ...demoReading, ...(JSON.parse(saved) as Partial<TelemetryReading>) };
  } catch {
    // Invalid or unavailable browser storage falls back to the demonstration reading.
  }
  return demoReading;
}

function toTelemetry(reading: TelemetryReading, offline: boolean): Telemetry {
  const critical = reading.tdsValue > 100 || reading.waterTemp > 70;
  const warning = !critical && reading.reservoirLevel > 95;
  return {
    tds: reading.tdsValue,
    temp: reading.waterTemp,
    level: reading.reservoirLevel,
    production: reading.accumulatedYield,
    status: critical
      ? "CRITICO_CONTAMINACAO"
      : warning
        ? "ATENCAO_SALINIDADE"
        : "POTAVEL_EXCELENTE",
    led: critical ? "RED" : warning ? "YELLOW" : "GREEN",
    offline,
  };
}

export function useTelemetry(): Telemetry {
  const [state, setState] = useState(() => toTelemetry(cachedReading(), true));
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/v1/telemetry/latest/${encodeURIComponent(DEVICE_ID)}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const reading = (await response.json()) as TelemetryReading;
        if (!active) return;
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(reading));
        setState(toTelemetry(reading, false));
      } catch {
        if (active) setState(toTelemetry(cachedReading(), true));
      }
    };
    void refresh();
    const id = window.setInterval(() => void refresh(), 5_000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);
  return state;
}

export type ChartReading = { hora: string; temperatura: number; producao: number };

const makeDemoHistory = (): ChartReading[] =>
  Array.from({ length: 24 }, (_, i) => {
    const sun = Math.max(0, Math.sin(((i - 6) / 12) * Math.PI));
    return {
      hora: `${String(i).padStart(2, "0")}h`,
      temperatura: +(28 + sun * 28 + Math.sin(i) * 0.8).toFixed(1),
      producao: +(sun * 1.9 + 0.08 + Math.cos(i * 1.3) * 0.06).toFixed(2),
    };
  });

function aggregateHistory(readings: TelemetryReading[]): ChartReading[] {
  const buckets = new Map<number, TelemetryReading[]>();
  for (const reading of readings) {
    const hour = new Date(reading.timestamp * 1000).getHours();
    const items = buckets.get(hour) ?? [];
    items.push(reading);
    buckets.set(hour, items);
  }
  return Array.from({ length: 24 }, (_, hour) => {
    const items = buckets.get(hour) ?? [];
    const avg = (pick: (reading: TelemetryReading) => number) =>
      items.length ? items.reduce((sum, item) => sum + pick(item), 0) / items.length : 0;
    return {
      hora: `${String(hour).padStart(2, "0")}h`,
      temperatura: +avg((reading) => reading.waterTemp).toFixed(1),
      producao: +avg((reading) => reading.accumulatedYield).toFixed(2),
    };
  });
}

export function useTelemetryHistory(): ChartReading[] {
  const [history, setHistory] = useState<ChartReading[]>(() => {
    if (typeof window === "undefined") return makeDemoHistory();
    try {
      const saved = window.localStorage.getItem(HISTORY_CACHE_KEY);
      if (saved) return JSON.parse(saved) as ChartReading[];
    } catch {
      // Fall back to the demonstration series.
    }
    return makeDemoHistory();
  });
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/v1/telemetry/history/${encodeURIComponent(DEVICE_ID)}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const result = (await response.json()) as { readings: TelemetryReading[] };
        const next = result.readings.length ? aggregateHistory(result.readings) : makeDemoHistory();
        if (!active) return;
        window.localStorage.setItem(HISTORY_CACHE_KEY, JSON.stringify(next));
        setHistory(next);
      } catch {
        // Keep the last synchronized chart or its demo fallback while offline.
      }
    };
    void refresh();
    const id = window.setInterval(() => void refresh(), 30_000);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);
  return history;
}

export type Severity = "good" | "warn" | "critical";
export type Alert = { id: number; severity: Severity; title: string; detail: string; time: string };

const templates: Omit<Alert, "id" | "time">[] = [
  { severity: "good", title: "Água dentro do limite operacional", detail: "TDS abaixo de 100 ppm" },
  { severity: "warn", title: "Reservatório próximo da capacidade", detail: "Nível acima de 95%" },
  {
    severity: "critical",
    title: "Risco de contaminação",
    detail: "TDS acima de 100 ppm ou temperatura acima de 70 °C",
  },
  {
    severity: "good",
    title: "Sincronização LoRa concluída",
    detail: "Telemetria recebida pelo gateway",
  },
  {
    severity: "warn",
    title: "Radiação abaixo do esperado",
    detail: "Produção pode ficar abaixo da estimativa",
  },
  {
    severity: "good",
    title: "Ciclo de limpeza finalizado",
    detail: "Verifique o condensador no próximo ciclo",
  },
];
const now = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
export const initialAlerts: Alert[] = templates.map((template, index) => ({
  id: index + 1,
  ...template,
  time: now(),
}));

export function useAlerts() {
  const [alerts, setAlerts] = useState(initialAlerts);
  useEffect(() => {
    const onFailure = (event: Event) => {
      const customEvent = event as CustomEvent<{ tdsValue: number }>;
      setAlerts((current) =>
        [
          {
            id: Date.now(),
            severity: "critical" as const,
            title: "Risco de contaminação detectado",
            detail: `TDS ${customEvent.detail.tdsValue} ppm · LED RED recomendado`,
            time: now(),
          },
          ...current,
        ].slice(0, 30),
      );
    };
    window.addEventListener("desol:telemetry-alert", onFailure);
    return () => window.removeEventListener("desol:telemetry-alert", onFailure);
  }, []);
  return alerts;
}

export const communities = [
  {
    id: "a",
    name: "Vila Soledade",
    x: 22,
    y: 30,
    dbm: -92,
    status: "online",
    sync: "agora",
    liters: 18.4,
  },
  {
    id: "b",
    name: "Comunidade Baixio",
    x: 48,
    y: 22,
    dbm: -88,
    status: "online",
    sync: "há 5 min",
    liters: 16.9,
  },
  {
    id: "c",
    name: "Sítio Pedra Branca",
    x: 72,
    y: 38,
    dbm: -104,
    status: "offline",
    sync: "há 3 h",
    liters: 12.1,
  },
  {
    id: "d",
    name: "Assentamento Boa Vista",
    x: 35,
    y: 64,
    dbm: -96,
    status: "online",
    sync: "há 11 min",
    liters: 20.2,
  },
  {
    id: "e",
    name: "Ribeirinha São José",
    x: 64,
    y: 72,
    dbm: -99,
    status: "sync",
    sync: "sincronizando",
    liters: 15.7,
  },
  {
    id: "f",
    name: "Gateway Central",
    x: 50,
    y: 48,
    dbm: -61,
    status: "gateway",
    sync: "agora",
    liters: 0,
  },
] as const;

export const syncHistory = [
  { time: "08:40", node: "Vila Soledade", packets: 128, mode: "LoRa" },
  { time: "08:12", node: "Comunidade Baixio", packets: 96, mode: "LoRa" },
  { time: "07:30", node: "Assentamento Boa Vista", packets: 211, mode: "Bluetooth" },
  { time: "05:05", node: "Sítio Pedra Branca", packets: 340, mode: "Offline → LoRa" },
  { time: "02:18", node: "Ribeirinha São José", packets: 74, mode: "LoRa" },
];

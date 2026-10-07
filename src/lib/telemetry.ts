import { useEffect, useState } from "react";

const jitter = (v: number, amt: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v + (Math.random() - 0.5) * amt));

export type Telemetry = { tds: number; temp: number; level: number; production: number };

export function useTelemetry(): Telemetry {
  const [t, setT] = useState<Telemetry>({ tds: 180, temp: 54.2, level: 82, production: 18.4 });
  useEffect(() => {
    const id = setInterval(() => {
      setT((p) => ({
        tds: Math.round(jitter(p.tds, 6, 165, 198)),
        temp: +jitter(p.temp, 0.6, 51, 57.5).toFixed(1),
        level: +Math.min(96, p.level + Math.random() * 0.15).toFixed(1),
        production: +(p.production + Math.random() * 0.02).toFixed(2),
      }));
    }, 2500);
    return () => clearInterval(id);
  }, []);
  return t;
}

export const history24h = Array.from({ length: 24 }, (_, i) => {
  const sun = Math.max(0, Math.sin(((i - 6) / 12) * Math.PI));
  return {
    hora: `${String(i).padStart(2, "0")}h`,
    temperatura: +(28 + sun * 28 + Math.sin(i) * 0.8).toFixed(1),
    producao: +(sun * 1.9 + 0.08 + Math.cos(i * 1.3) * 0.06).toFixed(2),
  };
});

export type Severity = "good" | "warn" | "critical";
export type Alert = { id: number; severity: Severity; title: string; detail: string; time: string };

const templates: Omit<Alert, "id" | "time">[] = [
  { severity: "good", title: "Água apta para consumo", detail: "TDS 178 ppm · padrão OMS atendido" },
  { severity: "warn", title: "Reservatório próximo da capacidade", detail: "Nível em 91% · 45,5 L de 50 L" },
  { severity: "critical", title: "Temperatura crítica", detail: "Coletor atingiu 71,3 °C · ventilação acionada" },
  { severity: "good", title: "Sincronização LoRa concluída", detail: "128 pacotes enviados · -92 dBm" },
  { severity: "warn", title: "Radiação abaixo do esperado", detail: "Nebulosidade 64% · produção -8%" },
  { severity: "good", title: "Ciclo de limpeza finalizado", detail: "Condensador · eficiência 98%" },
];

const now = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export const initialAlerts: Alert[] = [
  { id: 1, ...templates[0]!, time: "08:42" },
  { id: 2, ...templates[1]!, time: "08:15" },
  { id: 3, ...templates[3]!, time: "07:58" },
  { id: 4, ...templates[2]!, time: "06:31" },
  { id: 5, ...templates[5]!, time: "05:10" },
  { id: 6, ...templates[4]!, time: "04:47" },
];

export function useAlerts() {
  const [alerts, setAlerts] = useState(initialAlerts);
  useEffect(() => {
    const id = setInterval(() => {
      const t = templates[Math.floor(Math.random() * templates.length)]!;
      setAlerts((a) => [{ id: Date.now(), ...t, time: now() }, ...a].slice(0, 30));
    }, 9000);
    return () => clearInterval(id);
  }, []);
  return alerts;
}

export const communities = [
  { id: "a", name: "Vila Soledade", x: 22, y: 30, dbm: -92, status: "online", sync: "há 2 min", liters: 18.4 },
  { id: "b", name: "Comunidade Baixio", x: 48, y: 22, dbm: -88, status: "online", sync: "há 5 min", liters: 16.9 },
  { id: "c", name: "Sítio Pedra Branca", x: 72, y: 38, dbm: -104, status: "offline", sync: "há 3 h", liters: 12.1 },
  { id: "d", name: "Assentamento Boa Vista", x: 35, y: 64, dbm: -96, status: "online", sync: "há 11 min", liters: 20.2 },
  { id: "e", name: "Ribeirinha São José", x: 64, y: 72, dbm: -99, status: "sync", sync: "sincronizando", liters: 15.7 },
  { id: "f", name: "Gateway Central", x: 50, y: 48, dbm: -61, status: "gateway", sync: "agora", liters: 0 },
] as const;

export const syncHistory = [
  { time: "08:40", node: "Vila Soledade", packets: 128, mode: "LoRa" },
  { time: "08:12", node: "Comunidade Baixio", packets: 96, mode: "LoRa" },
  { time: "07:30", node: "Assentamento Boa Vista", packets: 211, mode: "Bluetooth" },
  { time: "05:05", node: "Sítio Pedra Branca", packets: 340, mode: "Offline → LoRa" },
  { time: "02:18", node: "Ribeirinha São José", packets: 74, mode: "LoRa" },
];

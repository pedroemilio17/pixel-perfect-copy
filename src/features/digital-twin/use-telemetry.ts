import { useCallback, useEffect, useMemo, useState } from "react";
import {
  demoSnapshot,
  type DemoScenario,
  type Reading,
  type Summary,
  type TelemetryEvent,
} from "./model";
import { loadConfig, loadSnapshot, type TelemetryConfig } from "./telemetry-client";

type Snapshot = {
  records: Reading[];
  history: Reading[];
  events: TelemetryEvent[];
  summary?: Summary;
};
const empty: Snapshot = { records: [], history: [], events: [] };
export function useDigitalTelemetry(from: string, to: string) {
  const [config, setConfig] = useState<TelemetryConfig>();
  const [forceDemo, setForceDemo] = useState(false);
  const [demoScenario, setDemoScenario] = useState<DemoScenario>("nominal");
  const demo = useMemo<Snapshot>(() => demoSnapshot(demoScenario), [demoScenario]);
  const [snapshot, setSnapshot] = useState<Snapshot>(empty);
  const [connection, setConnection] = useState<"connecting" | "ready" | "disconnected">(
    "connecting",
  );
  const [error, setError] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const mode: "demo" | "real" | "checking" =
    forceDemo || config?.mode === "demo" ? "demo" : config?.mode === "real" ? "real" : "checking";
  const retry = useCallback(() => {
    setForceDemo(false);
    setAttempt((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setConnection("connecting");
    loadConfig(controller.signal)
      .then((next) => {
        if (controller.signal.aborted) return;
        setConfig(next);
        setError(undefined);
        setSnapshot((current) =>
          current.records.some((record) => record.deviceId !== next.deviceId) ? empty : current,
        );
        if (next.mode === "demo") setConnection("ready");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setError("Não foi possível consultar a configuração da telemetria.");
        setConnection("disconnected");
      });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    if (mode !== "real" || !config || (from && to && Date.parse(from) > Date.parse(to))) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    setConnection("connecting");
    const poll = async () => {
      try {
        const next = await loadSnapshot(
          config,
          from || new Date(Date.now() - 86_400_000).toISOString(),
          to || new Date().toISOString(),
          controller.signal,
        );
        if (controller.signal.aborted) return;
        setSnapshot(next);
        setConnection("ready");
        setError(undefined);
        failures = 0;
      } catch {
        if (controller.signal.aborted) return;
        setConnection("disconnected");
        setError(
          "API indisponível ou resposta inválida. As últimas leituras reais são mantidas; o estado atual do hardware é desconhecido.",
        );
        failures++;
      }
      timer = setTimeout(() => void poll(), Math.min(60_000, 15_000 * 2 ** Math.min(failures, 2)));
    };
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [config, mode, from, to, attempt]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return {
    ...(mode === "demo" ? demo : snapshot),
    config,
    mode,
    demoScenario,
    setDemoScenario,
    connection: mode === "demo" ? ("ready" as const) : connection,
    error: mode === "demo" ? undefined : error,
    now,
    retry,
    showDemo: () => setForceDemo(true),
  };
}

import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import {
  formatTimestamp,
  formatValue,
  healthLabels,
  isSensor,
  parts,
  sensorIds,
  sensors,
  type ComponentId,
  type Health,
  type Reading,
  type SensorId,
} from "./model";
import { COMPONENT_DWELL_SECONDS } from "./presentation";

export type ViewerTelemetry = {
  readings: Partial<Record<SensorId, Reading>>;
  health: Record<SensorId, Health>;
  mode: "demo" | "real" | "checking";
  error?: string | null | undefined;
};
const qualityLabels = { good: "Boa", suspect: "Suspeita", bad: "Inválida", missing: "Ausente" };

export default function ComponentCallout({
  selected,
  telemetry,
  touring,
  remaining,
  position,
  count,
  onPause,
  onResume,
  onNext,
  onReset,
}: {
  selected: ComponentId;
  telemetry: ViewerTelemetry;
  touring: boolean;
  remaining: number;
  position: number;
  count: number;
  onPause: () => void;
  onResume: () => void;
  onNext: () => void;
  onReset: () => void;
}) {
  const component = isSensor(selected) ? sensors[selected] : parts[selected];
  const reading = isSensor(selected) ? telemetry.readings[selected] : undefined;
  const demo = telemetry.mode === "demo";
  return (
    <>
      <div className="dt-callout-heading">
        <span className="dt-eyebrow">{touring ? "Apresentação 360°" : "Componente em foco"}</span>
        <span className="dt-status dt-status-demo">
          {demo
            ? "DEMO · Dados simulados"
            : telemetry.mode === "checking"
              ? "Verificando API"
              : "API real"}
        </span>
      </div>
      <h2>{component.label}</h2>
      <p className="dt-callout-description">{component.description}</p>
      {telemetry.error && (
        <p className="dt-callout-error" role="status">
          {telemetry.error}
        </p>
      )}
      {isSensor(selected) ? (
        <>
          <div className="dt-callout-value">
            {formatValue(reading)}
            <small>{selected === "gateway" ? "" : sensors[selected].unit}</small>
          </div>
          <span className={`dt-status dt-status-${demo ? "demo" : telemetry.health[selected]}`}>
            <span />
            {demo
              ? "Simulação · saúde física não confirmada"
              : healthLabels[telemetry.health[selected]]}
          </span>
          <dl className="dt-reading-details">
            <div>
              <dt>Última amostra</dt>
              <dd>{formatTimestamp(reading?.timestamp)}</dd>
            </div>
            <div>
              <dt>Qualidade</dt>
              <dd>{reading ? qualityLabels[reading.quality] : "Sem dados"}</dd>
            </div>
            <div>
              <dt>Origem</dt>
              <dd>
                {reading?.source === "demo"
                  ? "Simulada"
                  : reading?.source === "real"
                    ? "API real"
                    : "Sem dados"}
              </dd>
            </div>
            {reading?.batteryPct != null && (
              <div>
                <dt>Bateria</dt>
                <dd>{reading.batteryPct}%</dd>
              </div>
            )}
            {reading?.rssiDbm != null && (
              <div>
                <dt>RSSI</dt>
                <dd>{reading.rssiDbm} dBm</dd>
              </div>
            )}
            {reading?.diagnosticCode && (
              <div>
                <dt>Diagnóstico</dt>
                <dd>{reading.diagnosticCode}</dd>
              </div>
            )}
          </dl>
        </>
      ) : (
        <>
          <p className="dt-callout-no-sensor">
            Este componente não possui medição dedicada configurada.
          </p>
          <span className="dt-eyebrow">Leituras gerais do dessalinizador</span>
          <div className="dt-callout-summary">
            {sensorIds.map((id) => (
              <div key={id}>
                <span>{sensors[id].shortLabel}</span>
                <strong>
                  {formatValue(telemetry.readings[id])}{" "}
                  <small>{id === "gateway" ? "" : sensors[id].unit}</small>
                </strong>
              </div>
            ))}
          </div>
        </>
      )}
      {touring && (
        <div className="dt-tour-timing">
          <div>
            <span>
              Componente {position} de {count}
            </span>
            <strong>Próximo em {remaining} s</strong>
          </div>
          <progress
            max={COMPONENT_DWELL_SECONDS}
            value={COMPONENT_DWELL_SECONDS - remaining}
            aria-label="Tempo de leitura do componente"
          />
        </div>
      )}
      <div className="dt-callout-actions">
        {touring ? (
          <>
            <button onClick={onPause}>
              <Pause size={15} /> Examinar componente
            </button>
            <button onClick={onNext} aria-label="Próximo componente">
              <SkipForward size={16} />
            </button>
          </>
        ) : (
          <>
            <button onClick={onResume}>
              <Play size={15} /> Retomar apresentação 360°
            </button>
            <button onClick={onReset} aria-label="Voltar à visão geral">
              <RotateCcw size={16} />
            </button>
          </>
        )}
      </div>
    </>
  );
}

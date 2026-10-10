import { lazy, Suspense, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  Box,
  ChevronDown,
  Clock3,
  Droplets,
  Gauge,
  Info,
  Radio,
  RefreshCw,
  ShieldQuestion,
  Sun,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/AppShell";
import {
  calculateHealth,
  demoRecords,
  filterRecords,
  formatTimestamp,
  formatValue,
  healthLabels,
  historyPoints,
  isSensor,
  latestBySensor,
  modelManifest,
  parts,
  recordsToCsv,
  sensorIds,
  sensors,
  type ComponentId,
  type DemoScenario,
  type Health,
  type Reading,
  type SensorId,
} from "./model";
import { useDigitalTelemetry } from "./use-telemetry";
import type { SceneReport } from "./ModelViewer";
import LegacyTelemetryPanel from "./LegacyTelemetryPanel";

const ModelViewer = lazy(() => import("./ModelViewer"));
const sensorIcons = {
  solar_irradiance: Sun,
  water_level: Droplets,
  production_flow: Gauge,
  gateway: Radio,
};
const qualityLabels = { good: "Boa", suspect: "Suspeita", bad: "Inválida", missing: "Ausente" };
const timeFormat = (timestamp: number) =>
  new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Cuiaba",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));

function HealthBadge({ health, demo }: { health: Health; demo: boolean }) {
  return (
    <span className={`dt-status dt-status-${demo ? "demo" : health}`}>
      <span />
      {demo ? "Simulação" : healthLabels[health]}
    </span>
  );
}
function HistoryChart({
  id,
  records,
  interval,
  demo,
}: {
  id: SensorId;
  records: Reading[];
  interval: number | undefined;
  demo: boolean;
}) {
  const { points, gaps } = useMemo(
    () => historyPoints(records, id, interval),
    [records, id, interval],
  );
  const sensor = sensors[id];
  const Icon = sensorIcons[id];
  return (
    <section className="dt-chart-card" aria-label={`Histórico de ${sensor.label}`}>
      <header>
        <div>
          <Icon size={16} />
          <h3>{sensor.label}</h3>
        </div>
        <span>{id === "gateway" ? "Estado de comunicação" : sensor.unit}</span>
      </header>
      <div
        className="dt-chart-plot"
        role="img"
        aria-label={`${points.filter((p) => !p.gap).length} amostras de ${sensor.label}. ${gaps} intervalos sem dados. ${demo ? "Dados simulados." : "Dados reais disponíveis."}`}
      >
        {points.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={points} margin={{ top: 15, right: 16, left: 2, bottom: 8 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="timestamp"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={timeFormat}
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                minTickGap={35}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                width={id === "gateway" ? 88 : 50}
                domain={id === "gateway" ? [-0.1, 1.1] : ["auto", "auto"]}
                {...(id === "gateway"
                  ? {
                      ticks: [0, 1],
                      tickFormatter: (v: number) => (v === 1 ? "Conectado" : "Offline"),
                    }
                  : {})}
                stroke="var(--color-muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#202a36",
                  border: "1px solid #344050",
                  borderRadius: 12,
                  color: "#fff",
                  fontSize: 12,
                }}
                labelFormatter={(v) => formatTimestamp(Number(v))}
                formatter={(v) => [
                  id === "gateway"
                    ? Number(v) === 1
                      ? "Conectado"
                      : "Desconectado"
                    : `${v} ${sensor.unit}`,
                  demo ? "Simulação" : "Leitura",
                ]}
              />
              <Line
                type={id === "gateway" ? "stepAfter" : "linear"}
                dataKey="value"
                stroke={id === "gateway" ? "var(--color-primary)" : "var(--color-water)"}
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="dt-empty">
            <Clock3 size={22} />
            <span>Sem registros nesse período</span>
          </div>
        )}
      </div>
      <footer>
        {demo ? "Série de referência · dados simulados" : "Somente registros recebidos"}
        <span>
          {gaps
            ? `${gaps} intervalo(s) sem dados`
            : points.length < 2
              ? "Amostras insuficientes para uma série"
              : interval
                ? "Sem lacunas detectadas"
                : "Cadência não configurada"}
        </span>
      </footer>
    </section>
  );
}

export default function DigitalTwinDashboard() {
  const [selected, setSelected] = useState<ComponentId>("solar_irradiance");
  const [scene, setScene] = useState<SceneReport | null>(null);
  const [reportSensor, setReportSensor] = useState<SensorId | "all">("all");
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [showLegacy, setShowLegacy] = useState(false);
  const from = fromInput ? `${fromInput}:00Z` : "";
  const to = toInput ? `${toInput}:00Z` : "";
  const telemetry = useDigitalTelemetry(from, to);
  const demo = telemetry.mode === "demo";
  const latest = latestBySensor(telemetry.records);
  const interval =
    telemetry.summary?.sampleIntervalSeconds ?? telemetry.config?.sampleIntervalSeconds;
  const health = (id: SensorId): Health =>
    telemetry.connection === "disconnected" || telemetry.mode !== "real"
      ? "unknown"
      : calculateHealth(
          latest[id],
          telemetry.now,
          interval,
          telemetry.summary?.hardwareConfirmed,
          telemetry.summary?.communication === "offline",
        );
  const current = isSensor(selected) ? latest[selected] : undefined;
  const rangeInvalid = !!from && !!to && Date.parse(from) > Date.parse(to);
  const filtered = filterRecords(
    telemetry.history,
    reportSensor,
    from ? Date.parse(from) : -Infinity,
    to ? Date.parse(to) : Infinity,
  );
  const events = telemetry.events.filter(
    (event) =>
      (!event.sensorId || reportSensor === "all" || event.sensorId === reportSensor) &&
      (!from || Date.parse(event.timestamp) >= Date.parse(from)) &&
      (!to || Date.parse(event.timestamp) <= Date.parse(to)),
  );
  const lastTimestamp = telemetry.records.length
    ? Math.max(...telemetry.records.map((r) => Date.parse(r.timestamp)))
    : undefined;
  const exportCsv = () => {
    const url = URL.createObjectURL(
      new Blob([recordsToCsv(filtered)], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `desol-${demo ? "demo" : "real"}-${reportSensor}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  };
  const preset = (hours: number) => {
    const anchor = demo
      ? Math.max(...telemetry.records.map((r) => Date.parse(r.timestamp)))
      : Date.now();
    setFromInput(new Date(anchor - hours * 3_600_000).toISOString().slice(0, 16));
    setToInput(new Date(anchor).toISOString().slice(0, 16));
  };

  return (
    <AppShell
      title="Gêmeo digital"
      subtitle="Explore o dessalinizador solar e acompanhe suas leituras."
      statusBar={
        <div className="dt-shell-status">
          <Box size={14} /> DeSol · Dessalinização solar <span>Modelo r33</span>
        </div>
      }
    >
      <div className="dt-dashboard">
        <div className={`dt-mode-banner ${demo ? "dt-mode-demo" : ""}`} role="status">
          <div>
            <span className="dt-mode-tag">
              {demo ? "DEMO" : telemetry.mode === "checking" ? "CONFIGURAÇÃO" : "API REAL"}
            </span>
            <div>
              <strong>
                {demo
                  ? "Dados simulados — sem telemetria real"
                  : telemetry.mode === "checking"
                    ? "Verificando a configuração de telemetria"
                    : "Telemetria por API · instalação física a confirmar"}
              </strong>
              <p>
                {demo
                  ? "Explore o modelo e os relatórios sem conectar dispositivos."
                  : telemetry.connection === "ready"
                    ? "Leituras validadas. A saúde depende da confirmação do hardware e do intervalo de amostragem."
                    : "A visualização 3D continua disponível durante a conexão."}
              </p>
            </div>
          </div>
          <span className="dt-reading-time">
            <Clock3 size={14} /> Última leitura: {formatTimestamp(lastTimestamp)}
          </span>
        </div>
        {telemetry.error && (
          <div className="dt-api-error" role="alert">
            <AlertTriangle size={18} />
            <p>{telemetry.error}</p>
            <button onClick={telemetry.retry}>
              <RefreshCw size={14} /> Reconectar
            </button>
            <button onClick={telemetry.showDemo}>Explorar DEMO</button>
          </div>
        )}
        {demo && telemetry.config?.mode === "real" && (
          <button className="dt-button mb-4" onClick={telemetry.retry}>
            <RefreshCw size={14} /> Retomar API real
          </button>
        )}
        <div className="dt-explorer-grid">
          <div>
            <Suspense
              fallback={<div className="dt-viewer dt-empty">Preparando visualizador 3D…</div>}
            >
              <ModelViewer
                selected={selected}
                onSelect={setSelected}
                onInspect={setScene}
                telemetry={{
                  readings: latest,
                  health: Object.fromEntries(sensorIds.map((id) => [id, health(id)])) as Record<
                    SensorId,
                    Health
                  >,
                  mode: telemetry.mode,
                  error: telemetry.error,
                }}
              />
            </Suspense>
            <div className="dt-model-meta">
              <span>
                <Box size={13} /> GLB local · revisão 33
              </span>
              <span>
                {scene
                  ? `${scene.objectCount} objetos · ${scene.found.filter(isSensor).length}/4 papéis de sensor encontrados`
                  : "Aguardando inspeção da cena"}
              </span>
            </div>
            {scene && scene.missingNames.length > 0 && (
              <p className="dt-binding-warning">
                <AlertTriangle size={14} /> {scene.missingNames.length} nomes esperados não
                encontrados no arquivo. Consulte o console; a seleção pelo menu permanece
                disponível.
              </p>
            )}
          </div>
          <aside className="dt-inspector" aria-label="Sensores e peça selecionada">
            <div className="dt-section-heading">
              <h2>Sensores do equipamento</h2>
              <span>04</span>
            </div>
            <div className="dt-sensor-menu">
              {sensorIds.map((id) => {
                const Icon = sensorIcons[id];
                return (
                  <button
                    key={id}
                    onClick={() => setSelected(id)}
                    aria-pressed={selected === id}
                    className={selected === id ? "is-selected" : ""}
                  >
                    <Icon size={16} />
                    <span>{sensors[id].shortLabel}</span>
                    <span className="dt-selection-dot" />
                  </button>
                );
              })}
            </div>
            <div className="dt-selected-panel" aria-live="polite">
              <span className="dt-eyebrow">
                {isSensor(selected) ? "Sensor selecionado" : "Componente selecionado"}
              </span>
              <h3>{isSensor(selected) ? sensors[selected].label : parts[selected].label}</h3>
              {isSensor(selected) && (
                <>
                  <div className="dt-detail-value">
                    {formatValue(current)}
                    <small>{selected === "gateway" ? "" : sensors[selected].unit}</small>
                  </div>
                  <HealthBadge health={health(selected)} demo={demo} />
                  <dl className="dt-reading-details">
                    <div>
                      <dt>Última amostra</dt>
                      <dd>{formatTimestamp(current?.timestamp)}</dd>
                    </div>
                    <div>
                      <dt>Qualidade</dt>
                      <dd>{current ? qualityLabels[current.quality] : "Sem dados"}</dd>
                    </div>
                    <div>
                      <dt>Origem</dt>
                      <dd>
                        {current?.source === "demo"
                          ? "Simulada"
                          : current?.source === "real"
                            ? "API real"
                            : "Não disponível"}
                      </dd>
                    </div>
                    {current?.batteryPct != null && (
                      <div>
                        <dt>Bateria</dt>
                        <dd>{current.batteryPct}%</dd>
                      </div>
                    )}
                    {current?.rssiDbm != null && (
                      <div>
                        <dt>RSSI</dt>
                        <dd>{current.rssiDbm} dBm</dd>
                      </div>
                    )}
                    {current?.diagnosticCode && (
                      <div>
                        <dt>Diagnóstico</dt>
                        <dd>{current.diagnosticCode}</dd>
                      </div>
                    )}
                  </dl>
                </>
              )}
              <p>
                {isSensor(selected) ? sensors[selected].description : parts[selected].description}
              </p>
              <div className="dt-binding-status">
                <Info size={13} />
                {scene
                  ? scene.found.includes(selected)
                    ? "Peça encontrada no GLB e vinculada à seleção."
                    : "Peça não encontrada neste GLB; vínculo 3D indisponível."
                  : "O vínculo será verificado após carregar o modelo."}
              </div>
              {isSensor(selected) && (
                <button
                  className="dt-text-button"
                  onClick={() => {
                    setReportSensor(selected);
                    document.getElementById("dt-reports")?.scrollIntoView({
                      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
                        ? "instant"
                        : "smooth",
                      block: "start",
                    });
                  }}
                >
                  Ver histórico deste sensor ↓
                </button>
              )}
            </div>
            <details className="dt-components">
              <summary>
                Explorar componentes <ChevronDown size={15} />
              </summary>
              <div>
                {Object.entries(parts).map(([id, part]) => (
                  <button
                    key={id}
                    onClick={() => setSelected(id as ComponentId)}
                    aria-pressed={selected === id}
                  >
                    {part.label}
                  </button>
                ))}
              </div>
            </details>
          </aside>
        </div>
        {demo && (
          <label className="dt-demo-controls">
            Cenário de demonstração
            <select
              aria-label="Cenário de demonstração"
              value={telemetry.demoScenario}
              onChange={(event) => telemetry.setDemoScenario(event.target.value as DemoScenario)}
            >
              <option value="nominal">Leituras de referência</option>
              <option value="gateway-offline">Simular gateway offline</option>
              <option value="bad-reading">Simular leitura inválida</option>
            </select>
            <span>Os cenários não alteram dados reais.</span>
          </label>
        )}
        <div className="dt-metrics">
          {sensorIds.map((id) => {
            const Icon = sensorIcons[id];
            const reading = latest[id];
            return (
              <button
                key={id}
                className={`dt-metric-card ${selected === id ? "is-selected" : ""}`}
                onClick={() => setSelected(id)}
                aria-pressed={selected === id}
              >
                <div className="dt-metric-heading">
                  <span>{sensors[id].shortLabel}</span>
                  <Icon size={18} />
                </div>
                <div className={`dt-metric-value ${id === "gateway" ? "dt-gateway-value" : ""}`}>
                  {formatValue(reading)} {id !== "gateway" && <small>{sensors[id].unit}</small>}
                </div>
                <HealthBadge health={health(id)} demo={demo} />
                {reading?.quality === "bad" && (
                  <span className="dt-invalid-reading">
                    Leitura inválida{demo ? " · simulação" : ""}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="dt-health-note">
          <ShieldQuestion size={19} />
          <p>
            {demo
              ? "A demonstração não confirma sensores instalados, comunicação LoRa, estado de saúde ou potabilidade da água."
              : !interval
                ? "Intervalo esperado não configurado. A idade das leituras é exibida, mas a saúde não pode ser confirmada."
                : telemetry.summary?.hardwareConfirmed
                  ? "Saúde calculada pela idade, qualidade e diagnóstico das leituras. Não há limites sanitários ou alarmes físicos presumidos."
                  : "A instalação do hardware ainda não foi confirmada pelo backend. Não há percentual de saúde presumido."}
          </p>
        </div>
        <section id="dt-reports" className="dt-reports" aria-labelledby="dt-reports-title">
          <div className="dt-reports-heading">
            <div>
              <span className="dt-eyebrow">Telemetria e relatórios</span>
              <h2 id="dt-reports-title">Histórico de leituras</h2>
              <p>
                {demo
                  ? "Amostras do pacote de demonstração de 09/10/2026."
                  : "Registros recebidos pela API; os filtros consultam o período solicitado."}{" "}
                Horários em Cuiabá (UTC−4).
              </p>
            </div>
            <button
              className="dt-button dt-button-primary"
              onClick={exportCsv}
              disabled={!filtered.length || rangeInvalid}
            >
              <ArrowDownToLine size={16} /> Exportar CSV <span>({filtered.length})</span>
            </button>
          </div>
          <div className="dt-report-filters">
            <label>
              Sensor
              <select
                aria-label="Filtrar por sensor"
                value={reportSensor}
                onChange={(event) => setReportSensor(event.target.value as SensorId | "all")}
              >
                <option value="all">Todos os sensores</option>
                {sensorIds.map((id) => (
                  <option key={id} value={id}>
                    {sensors[id].label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              De (UTC)
              <input
                aria-label="Início do período em UTC"
                type="datetime-local"
                value={fromInput}
                onChange={(event) => setFromInput(event.target.value)}
              />
            </label>
            <label>
              Até (UTC)
              <input
                aria-label="Fim do período em UTC"
                type="datetime-local"
                value={toInput}
                onChange={(event) => setToInput(event.target.value)}
              />
            </label>
            <div className="dt-range-presets">
              <button onClick={() => preset(1)}>1 h</button>
              <button onClick={() => preset(24)}>24 h</button>
              <button
                onClick={() => {
                  setFromInput("");
                  setToInput("");
                }}
              >
                Limpar período
              </button>
            </div>
          </div>
          {rangeInvalid && (
            <p role="alert" className="dt-binding-warning">
              A data inicial deve ser anterior à data final.
            </p>
          )}
          <div className="dt-history-grid">
            {sensorIds
              .filter((id) => reportSensor === "all" || id === reportSensor)
              .map((id) => (
                <HistoryChart
                  key={id}
                  id={id}
                  records={filtered}
                  interval={demo ? 900 : interval}
                  demo={demo}
                />
              ))}
          </div>
          <details className="dt-records">
            <summary>
              Consultar registros disponíveis <span>{filtered.length} registros</span>
            </summary>
            <div className="dt-table-scroll">
              <table>
                <caption className="sr-only">
                  Registros filtrados de telemetria, com horário, sensor, unidade, qualidade e
                  origem.
                </caption>
                <thead>
                  <tr>
                    <th>Data · Cuiabá</th>
                    <th>Sensor</th>
                    <th>Valor</th>
                    <th>Qualidade</th>
                    <th>Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={`${r.sensorId}-${r.timestamp}-${i}`}>
                      <td>{formatTimestamp(r.timestamp)}</td>
                      <td>{sensors[r.sensorId].shortLabel}</td>
                      <td>
                        {formatValue(r)} {r.unit !== "boolean" ? r.unit : ""}
                      </td>
                      <td>{qualityLabels[r.quality]}</td>
                      <td>{r.source === "demo" ? "Simulada" : "Real"}</td>
                    </tr>
                  ))}
                  {!filtered.length && (
                    <tr>
                      <td colSpan={5}>Nenhum registro disponível nesse período.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </details>
        </section>
        <section className="dt-events" aria-labelledby="dt-events-title">
          <div className="dt-section-heading">
            <h2 id="dt-events-title">Eventos e alertas</h2>
            <span>{events.length}</span>
          </div>
          {events.length ? (
            <ul>
              {events.map((event) => (
                <li key={event.id}>
                  <span className={`dt-event-icon dt-event-${event.severity}`}>
                    {event.severity === "info" ? <Info size={17} /> : <AlertTriangle size={17} />}
                  </span>
                  <div>
                    <p>{event.message}</p>
                    <span>
                      {formatTimestamp(event.timestamp)} ·{" "}
                      {event.source === "demo"
                        ? "Evento de demonstração"
                        : "Evento recebido do backend"}
                      {event.sensorId ? ` · ${sensors[event.sensorId].shortLabel}` : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="dt-empty">
              Nenhum evento recebido no período. Isso não confirma ausência de falhas no hardware.
            </div>
          )}
        </section>
        <details
          className="dt-legacy"
          onToggle={(event) => setShowLegacy(event.currentTarget.open)}
        >
          <summary>
            <Activity size={16} /> Painel anterior · métricas complementares{" "}
            <ChevronDown size={15} />
          </summary>
          {showLegacy && <LegacyTelemetryPanel />}
        </details>
        <footer className="dt-page-footer">
          <span>DeSol · Gêmeo digital · revisão {modelManifest.revision}</span>
          <span>Dimensões conceituais; não utilizar como cotas de fabricação.</span>
        </footer>
      </div>
    </AppShell>
  );
}

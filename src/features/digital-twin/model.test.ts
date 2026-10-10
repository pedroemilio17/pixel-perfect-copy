import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  calculateHealth,
  componentFromName,
  componentFromObject,
  demoHistory,
  demoRecords,
  demoSnapshot,
  filterRecords,
  historyPoints,
  inspectSceneNames,
  recordsToCsv,
  telemetrySchema,
  type Reading,
} from "./model";

const reading = { ...demoRecords[0]!, source: "real" as const };
const now = Date.parse(reading.timestamp);
describe("Mapeamento do GLB r33", () => {
  it.each([
    ["SENSOR_solar_irradiance_dome", "solar_irradiance"],
    ["SENSOR_water_level_external_housing_primitive0", "water_level"],
    ["SENSOR_product_water_flow_detector", "production_flow"],
    ["SENSOR_case_telemetry_online_indicator", "gateway"],
    ["BASIN_gutter_freshwater_drain_to_existing_outlet", "basin_and_gutter"],
    ["PV_cells", "solar_panel"],
    ["FILTER_mineralizer", "collection_and_filter"],
  ])("mapeia %s para %s", (name, expected) => expect(componentFromName(name)).toBe(expected));
  it("procura ancestrais e prioriza sensores sobre grupos", () => {
    expect(
      componentFromObject({
        name: "PV_mesh",
        parent: { name: "SENSOR_solar_irradiance_pyranometer" },
      }),
    ).toBe("solar_irradiance");
    expect(componentFromName("unknown_part")).toBeUndefined();
  });
  it("carrega o GLB real e encontra os seis sensores e os quatro papéis", async () => {
    const file = readFileSync("public/models/dessalinizador-solar-r33.glb");
    const bytes = new ArrayBuffer(file.byteLength);
    new Uint8Array(bytes).set(file);
    const scene = (await new GLTFLoader().parseAsync(bytes, "")).scene;
    const names: string[] = [];
    scene.traverse((object) => names.push(object.name));
    const report = inspectSceneNames(names);
    expect(report.missingNames).toEqual([]);
    expect(names.filter((name) => name.startsWith("SENSOR_"))).toHaveLength(6);
    expect(report.found).toEqual(
      expect.arrayContaining(["solar_irradiance", "water_level", "production_flow", "gateway"]),
    );
  });
});

describe("Saúde sem presumir hardware", () => {
  it("não trata DEMO como hardware operacional", () =>
    expect(calculateHealth(demoRecords[0], now, 60, true)).toBe("unknown"));
  it("não confirma saúde sem dados, intervalo ou confirmação física", () => {
    expect(calculateHealth(undefined, now, 60, true)).toBe("unknown");
    expect(calculateHealth(reading, now, undefined, true)).toBe("unknown");
    expect(calculateHealth(reading, now, 60, false)).toBe("unknown");
  });
  it("reconhece dado atual e atraso com intervalo explicitamente configurado", () => {
    expect(calculateHealth(reading, now + 60_000, 60, true)).toBe("ok");
    expect(calculateHealth(reading, now + 121_000, 60, true)).toBe("stale");
  });
  it("trata falha explícita, diagnóstico e qualidade ruim", () => {
    expect(calculateHealth(undefined, now, 60, true, true)).toBe("offline");
    expect(calculateHealth({ ...reading, quality: "bad" }, now, 60, true)).toBe("error");
    expect(calculateHealth({ ...reading, diagnosticCode: "CRC" }, now, 60, true)).toBe("error");
    expect(calculateHealth({ ...reading, quality: "suspect" }, now, 60, true)).toBe("unknown");
    expect(calculateHealth({ ...reading, value: null }, now, 60, true)).toBe("unknown");
  });
  it("ignora timestamps inválidos ou futuros", () => {
    expect(calculateHealth({ ...reading, timestamp: "invalid" }, now, 60, true)).toBe("unknown");
    expect(calculateHealth(reading, now - 120_000, 60, true)).toBe("unknown");
  });
  it("exige atualidade e confirmação para interpretar estado do gateway", () => {
    const gateway = {
      ...demoRecords.find((r) => r.sensorId === "gateway")!,
      source: "real" as const,
      value: false,
    };
    expect(calculateHealth(gateway, now, 60, true)).toBe("offline");
    expect(calculateHealth(gateway, now, undefined, false)).toBe("unknown");
    expect(calculateHealth(gateway, now + 121_000, 60, true)).toBe("stale");
  });
});
describe("Contrato, histórico e relatório", () => {
  it("simula falhas sem mudar a origem ou os dados de referência", () => {
    const offline = demoSnapshot("gateway-offline");
    expect(offline.records.find((r) => r.sensorId === "gateway")?.value).toBe(false);
    expect(offline.events.at(-1)?.source).toBe("demo");
    const bad = demoSnapshot("bad-reading");
    expect(bad.records.find((r) => r.sensorId === "solar_irradiance")?.quality).toBe("bad");
    expect(demoRecords[0]?.value).toBe(725.4);
    expect(calculateHealth(bad.records[0], now, 60, true)).toBe("unknown");
  });
  it("valida unidade, tipo, origem e timestamp das leituras", () => {
    expect(telemetrySchema.safeParse({ ...reading, unit: "ppm" }).success).toBe(false);
    expect(telemetrySchema.safeParse({ ...reading, value: true }).success).toBe(false);
    expect(telemetrySchema.safeParse({ ...reading, timestamp: "ontem" }).success).toBe(false);
  });
  it("marca lacunas e qualidade ruim sem inventar zeros", () => {
    const next: Reading = {
      ...reading,
      timestamp: new Date(now + 300_000).toISOString(),
      quality: "missing",
      value: null,
    };
    const chart = historyPoints([reading, next], reading.sensorId, 60);
    expect(chart.gaps).toBe(1);
    expect(chart.points.map((p) => p.value)).toEqual([725.4, null, null]);
  });
  it("filtra o período e exporta apenas os registros disponíveis", () => {
    const records = filterRecords(demoHistory, "solar_irradiance", now - 30 * 60_000, now);
    expect(records).toHaveLength(3);
    expect(recordsToCsv(records).split("\r\n")).toHaveLength(4);
    expect(recordsToCsv(records)).toContain('"demo"');
    expect(recordsToCsv([{ ...reading, deviceId: '=HYPERLINK("bad")' }])).toContain("'=HYPERLINK");
  });
});

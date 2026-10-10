import { afterEach, describe, expect, it, vi } from "vitest";
import { loadModelBytes } from "./model-loader";
import { loadConfig, loadSnapshot } from "./telemetry-client";
import { demoRecords } from "./model";
import { handleDigitalTwinApi } from "@/lib/digital-twin-proxy.server";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("Falhas de GLB e API", () => {
  it("sincroniza uma resposta real válida sem conversões de unidade", async () => {
    const records = demoRecords.map((record) => ({
      ...record,
      deviceId: "real-device",
      source: "real" as const,
    }));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve(
          Response.json(
            url.includes("summary")
              ? {
                  deviceId: "real-device",
                  hardwareConfirmed: true,
                  communication: "online",
                  sampleIntervalSeconds: 60,
                }
              : url.includes("events")
                ? { events: [] }
                : { records },
          ),
        ),
      ),
    );
    const result = await loadSnapshot(
      { mode: "real", deviceId: "real-device" },
      "2026-10-09T12:00:00Z",
      "2026-10-09T13:00:00Z",
      new AbortController().signal,
    );
    expect(result.records).toHaveLength(4);
    expect(result.records.find((r) => r.sensorId === "water_level")?.unit).toBe("mm");
    expect(result.summary.hardwareConfirmed).toBe(true);
  });
  it("propaga 404 GLB para o estado de falha recuperável", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Not found", { status: 404 })));
    await expect(loadModelBytes("/missing.glb", new AbortController().signal)).rejects.toThrow(
      "HTTP 404",
    );
  });
  it("rejeita HTML retornado no lugar do GLB", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>this is not a model</html>")),
    );
    await expect(loadModelBytes("/missing.glb", new AbortController().signal)).rejects.toThrow(
      "GLB 2.0",
    );
  });
  it("não substitui dados reais por DEMO quando a API cai", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Offline", { status: 503 })));
    await expect(
      loadSnapshot(
        { mode: "real", deviceId: "real-device" },
        "2026-10-09T12:00:00Z",
        "2026-10-09T13:00:00Z",
        new AbortController().signal,
      ),
    ).rejects.toThrow("HTTP 503");
  });
  it("rejeita fixtures devolvidas por uma API em modo real", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockImplementation((url: string) =>
          Promise.resolve(
            Response.json(
              url.includes("summary")
                ? { deviceId: "real-device", communication: "online", hardwareConfirmed: true }
                : url.includes("events")
                  ? { events: [] }
                  : { records: demoRecords },
            ),
          ),
        ),
    );
    await expect(
      loadSnapshot(
        { mode: "real", deviceId: "real-device" },
        "2026-10-09T12:00:00Z",
        "2026-10-09T13:00:00Z",
        new AbortController().signal,
      ),
    ).rejects.toThrow("outra origem");
  });
  it("retorna DEMO por configuração sem conexões externas", async () => {
    vi.stubEnv("DESOL_API_BASE_URL", "");
    const response = await handleDigitalTwinApi(
      new Request("http://localhost/api/digital-twin/config"),
      {},
    );
    expect(await response!.json()).toMatchObject({ mode: "demo" });
  });
  it("mantém o token no backend e envia-o somente ao destino configurado", async () => {
    const bindings = {
      DESOL_API_BASE_URL: "https://example.test/api",
      DESOL_DEVICE_ID: "sensor-a",
      DESOL_API_TOKEN: "test-only-token",
      DESOL_SAMPLE_INTERVAL_SECONDS: "60",
    };
    const response = await handleDigitalTwinApi(
      new Request("http://localhost/api/digital-twin/config"),
      bindings,
    );
    expect(await response!.json()).toEqual({
      mode: "real",
      deviceId: "sensor-a",
      sampleIntervalSeconds: 60,
    });
    const mock = vi.fn().mockResolvedValue(Response.json({ records: [] }));
    vi.stubGlobal("fetch", mock);
    await handleDigitalTwinApi(new Request("http://localhost/api/digital-twin/latest"), bindings);
    expect(String(mock.mock.calls[0]![0])).toBe(
      "https://example.test/api/devices/sensor-a/telemetry/latest",
    );
    expect(mock.mock.calls[0]![1].redirect).toBe("error");
    expect(mock.mock.calls[0]![1].headers.authorization).toBe("Bearer test-only-token");
  });
  it("trata falha do upstream e bloqueia período invertido", async () => {
    const bindings = {
      DESOL_API_BASE_URL: "https://example.test/api",
      DESOL_DEVICE_ID: "sensor-a",
    };
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Network unreachable")));
    const response = await handleDigitalTwinApi(
      new Request("http://localhost/api/digital-twin/latest"),
      bindings,
    );
    expect(response!.status).toBe(503);
    const badRange = await handleDigitalTwinApi(
      new Request(
        "http://localhost/api/digital-twin/history?from=2026-10-10T00:00:00Z&to=2026-10-09T00:00:00Z",
      ),
      bindings,
    );
    expect(badRange!.status).toBe(400);
  });
});

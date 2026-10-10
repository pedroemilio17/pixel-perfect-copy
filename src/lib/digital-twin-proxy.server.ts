type RuntimeBindings = Record<string, unknown>;
function setting(name: string, bindings: RuntimeBindings) {
  const value = bindings[name] ?? process.env[name];
  return typeof value === "string" ? value.trim() : undefined;
}
function configuration(bindings: RuntimeBindings) {
  const base = setting("DESOL_API_BASE_URL", bindings);
  const deviceId = setting("DESOL_DEVICE_ID", bindings) || "solar-distiller-demo-001";
  const configuredInterval = setting("DESOL_SAMPLE_INTERVAL_SECONDS", bindings);
  const interval = configuredInterval ? Number(configuredInterval) : undefined;
  if (interval !== undefined && (!Number.isFinite(interval) || interval <= 0))
    throw new Error("Invalid interval");
  if (!base) return { mode: "demo" as const, deviceId };
  const url = new URL(base.endsWith("/") ? base : base + "/");
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== "https:" &&
      !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
  )
    throw new Error("Invalid base URL");
  if (!setting("DESOL_DEVICE_ID", bindings))
    throw new Error("Device ID required for real telemetry");
  return {
    mode: "real" as const,
    deviceId,
    baseUrl: url,
    interval,
    token: setting("DESOL_API_TOKEN", bindings),
  };
}
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "cache-control": "no-store" } });
export async function handleDigitalTwinApi(
  request: Request,
  env: unknown,
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/digital-twin/")) return null;
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const route = url.pathname.slice("/api/digital-twin/".length);
  if (!["config", "latest", "history", "events", "summary"].includes(route))
    return json({ error: "Not found" }, 404);
  try {
    const config = configuration(env && typeof env === "object" ? (env as RuntimeBindings) : {});
    if (route === "config")
      return json({
        mode: config.mode,
        deviceId: config.deviceId,
        ...(config.mode === "real" && config.interval !== undefined
          ? { sampleIntervalSeconds: config.interval }
          : {}),
      });
    if (config.mode === "demo") return json({ error: "Real telemetry is not configured" }, 503);
    const resource = {
      latest: "telemetry/latest",
      history: "telemetry/history",
      events: "events",
      summary: "summary",
    }[route];
    const upstream = new URL(
      `devices/${encodeURIComponent(config.deviceId)}/${resource}`,
      config.baseUrl,
    );
    for (const name of ["from", "to"]) {
      const value = url.searchParams.get(name);
      if (value) {
        if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value)))
          return json({ error: "Invalid date range" }, 400);
        upstream.searchParams.set(name, new Date(value).toISOString());
      }
    }
    if (
      upstream.searchParams.has("from") &&
      upstream.searchParams.has("to") &&
      Date.parse(upstream.searchParams.get("from")!) > Date.parse(upstream.searchParams.get("to")!)
    )
      return json({ error: "Invalid date range" }, 400);
    const response = await fetch(upstream, {
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(7_000)]),
      redirect: "error",
      headers: {
        accept: "application/json",
        ...(config.token ? { authorization: `Bearer ${config.token}` } : {}),
      },
    });
    if (!response.ok)
      return json({ error: "Telemetry service unavailable" }, response.status === 404 ? 404 : 502);
    if (!response.headers.get("content-type")?.includes("application/json"))
      return json({ error: "Invalid service response" }, 502);
    return json(await response.json());
  } catch {
    return json({ error: "Telemetry configuration or service unavailable" }, 503);
  }
}

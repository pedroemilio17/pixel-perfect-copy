import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 20_000 },
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      ...(process.env["CHROMIUM_PATH"] ? { executablePath: process.env["CHROMIUM_PATH"] } : {}),
      args: ["--no-sandbox", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"],
    },
  },
  webServer: {
    command: "npm run dev -- --host 0.0.0.0 --port 3000 --strictPort",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env["CI"],
    timeout: 30_000,
  },
});

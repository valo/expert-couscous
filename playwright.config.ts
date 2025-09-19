import { defineConfig, devices } from "@playwright/test";
import process from "node:process";

const DEFAULT_PORT = 3100;
const resolvedPort =
  process.env.E2E_PORT ?? process.env.PORT ?? String(DEFAULT_PORT);
const parsedPort = Number.parseInt(resolvedPort, 10);
const PORT = Number.isNaN(parsedPort) ? DEFAULT_PORT : parsedPort;
const HOST = "127.0.0.1";
const BASE_URL = `http://${HOST}:${PORT}`;
const NODE_OPTIONS = [process.env.NODE_OPTIONS]
  .filter(Boolean)
  .join(" ");

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "dot" : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      NEXT_PUBLIC_PSM_ADDRESS: "0x0000000000000000000000000000000000000001",
      NEXT_PUBLIC_USDC_ADDRESS: "0x0000000000000000000000000000000000000002",
      NEXT_PUBLIC_DBUSD_ADDRESS: "0x0000000000000000000000000000000000000003",
      PORT: String(PORT),
      NODE_OPTIONS,
    },
  },
});

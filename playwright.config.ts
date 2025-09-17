import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import process from "node:process";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const HOST = "127.0.0.1";
const BASE_URL = `http://${HOST}:${PORT}`;
const indexedDbSetup = path.join(__dirname, "tests/e2e/setup-indexeddb.js");
const NODE_OPTIONS = [process.env.NODE_OPTIONS, `--require ${indexedDbSetup}`]
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
      NODE_OPTIONS,
    },
  },
});

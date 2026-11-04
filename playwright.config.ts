import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    launchOptions: {
      executablePath: "/usr/bin/chromium",
      args: ["--no-sandbox"],
    },
  },
  reporter: "list",
  webServer: {
    command: "DEMO_MODE=true npm run start",
    env: { DEMO_DATA_DIR: mkdtempSync(path.join(tmpdir(), "reinos-e2e-")) },
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 60000,
  },
});

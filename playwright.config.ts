import { defineConfig, devices } from "@playwright/test";
import { TEST_DATABASE_URL } from "./tests/support/test-db";

// The browser tests run a production build of the app on its own port, wired
// to the throwaway test database, so they never touch dev or production data.
const PORT = 3100;

// Set E2E_SKIP_BUILD=1 to reuse the existing .next-e2e build when re-running.
const buildStep = process.env.E2E_SKIP_BUILD ? "" : "npm run build && ";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  // One shared database, so tests run one at a time.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `${buildStep}npm run start -- --port ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 300_000,
    reuseExistingServer: false,
    env: {
      NEXT_DIST_DIR: ".next-e2e",
      DATABASE_URL: TEST_DATABASE_URL,
      AUTH_SECRET: "e2e-test-secret-not-for-production",
      AUTH_TRUST_HOST: "true",
      AUTH_URL: `http://localhost:${PORT}`,
    },
  },
});

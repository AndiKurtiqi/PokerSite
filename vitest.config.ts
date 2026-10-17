import path from "node:path";
import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./tests/support/test-db";

// Vitest is always run from the project root.
const alias = { "@": path.resolve(process.cwd(), "src") };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "api",
          environment: "node",
          include: ["tests/api/**/*.test.ts"],
          globalSetup: ["tests/support/global-setup.ts"],
          setupFiles: ["tests/support/api-setup.ts"],
          env: { DATABASE_URL: TEST_DATABASE_URL, AUTH_SECRET: "test-secret" },
          // All files share one database, so run them one at a time.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});

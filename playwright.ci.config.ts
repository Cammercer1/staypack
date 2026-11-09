import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["ci/**/*.spec.ts", "staging/str-step-order.spec.ts", "staging/lint-regression.spec.ts", "staging/document-links.spec.ts"],
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://127.0.0.1:4173", httpCredentials: { username: "preview", password: "ci-local-only" }, viewport: { width: 1440, height: 1000 }, screenshot: "only-on-failure" },
  webServer: { command: "node scripts/ci/serve-preview.mjs", url: "http://127.0.0.1:4173", timeout: 90_000, reuseExistingServer: false },
});

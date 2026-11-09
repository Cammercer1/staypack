import { defineConfig } from "@playwright/test";

const remote = process.env.CI_PREVIEW_URL;
if (remote && !/^https:\/\/staypack-prv-[a-f0-9]{16}\.cameronmercer1991\.workers\.dev$/.test(remote)) throw new Error("Live UI checks require an isolated branch preview URL");
const password = remote ? process.env.CI_PREVIEW_PASSWORD : "ci-local-only";
if (!password) throw new Error("Missing private preview password");

export default defineConfig({
  testDir: "./tests",
  testMatch: ["ci/**/*.spec.ts", "staging/str-step-order.spec.ts", "staging/lint-regression.spec.ts", "staging/document-links.spec.ts"],
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: remote || "http://127.0.0.1:4173", httpCredentials: { username: "preview", password }, viewport: { width: 1440, height: 1000 }, screenshot: "only-on-failure" },
  webServer: remote ? undefined : { command: "node scripts/ci/serve-preview.mjs", url: "http://127.0.0.1:4173", timeout: 90_000, reuseExistingServer: false },
});

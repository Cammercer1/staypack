import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    // Ordinary tests use mocked Supabase storage, even with R2 enabled locally.
    // Explicit live checks opt in; R2 unit tests replace their own SDK client.
    env: { STORAGE_PROVIDER: process.env.RUN_R2_STORAGE_SMOKE === "1" || process.env.STR_LIVE_TEST === "1" ? (process.env.STORAGE_PROVIDER || "supabase") : "supabase" },
    include: ["lib/**/*.test.ts", "components/**/*.test.{ts,tsx}", "app/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});

import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { createHash } from "node:crypto";
import { patchCssModules } from "vite-css-modules";
import path from "node:path";

export default defineConfig({
  // CI receives only explicit build-time public values. Never read a developer's dotenv files.
  envDir: process.env.STAYPACK_CI_BUILD === "1" ? false : undefined,
  resolve: {
    alias: { "@/lib/hosting/jobQueue": path.resolve(import.meta.dirname, "cloudflare/jobQueue.ts") },
  },
  plugins: [
    patchCssModules({ exportMode: "default" }),
    vinext(),
    cloudflare({
      configPath: process.env.STAYPACK_CLOUDFLARE_CONFIG || "wrangler.jsonc",
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
  css: {
    modules: {
      generateScopedName(name: string, filename: string) {
        const relativePath = path.relative(import.meta.dirname, filename.replace(/\?.*$/, "")).replaceAll("\\", "/");
        return `_${name}_${createHash("sha256").update(relativePath).digest("hex").slice(0, 7)}`;
      },
    },
  },
});

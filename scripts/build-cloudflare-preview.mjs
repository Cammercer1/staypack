import { spawn } from "node:child_process";
import { readFile, readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const production = process.argv.includes("--production");
const configPath = production ? "wrangler.app.jsonc" : "wrangler.jsonc";
const config = JSON.parse(await readFile(resolve(root, configPath), "utf8"));
if (config.name !== (production ? "staypack-app" : "staypack-app-preview") || config.account_id !== "fc594f30144c9ba2a1cb9a5c3ce1313a" || (!production && config.routes?.length)
  || config.routes?.some(route => !["staypack.app/*", "staypack.app/proposal/print/*"].includes(route.pattern))) {
  throw new Error("Unexpected Cloudflare app name, account or routes");
}
try { process.loadEnvFile(resolve(root, ".env.local")); } catch (error) { if (error.code !== "ENOENT") throw error; }
if (new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname !== "qmtfugaeujeikyegoxwi.supabase.co") {
  throw new Error("Unexpected Supabase project");
}
const origin = production ? "https://staypack.app" : "https://staypack-app-preview.cameronmercer1991.workers.dev";
try {
  const code = await new Promise((accept, reject) => {
    const child = spawn("npm", ["run", "build:vinext"], {
      stdio: "inherit",
      env: { ...process.env, STAYPACK_CLOUDFLARE_CONFIG: configPath, NEXT_PUBLIC_SITE_URL: origin, NEXT_PUBLIC_REPORTS_URL: origin },
    });
    child.on("error", reject);
    child.on("close", accept);
  });
  if (code !== 0) throw new Error(`Cloudflare build failed (${code})`);
} finally {
  // The adapter copies local dotenv values for local emulation. They are not a
  // deployment artifact; remove that generated copy even after a failed build.
  await rm(resolve(root, "dist/server/.dev.vars"), { force: true });
}
const privateValues = Object.entries(process.env).filter(([name, value]) =>
  !name.startsWith("NEXT_PUBLIC_") && /KEY|TOKEN|SECRET|PASSWORD/.test(name) && value.length > 15,
);
for (const directory of ["dist/client", "dist/server"]) {
  for (const entry of await readdir(resolve(root, directory), { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const content = await readFile(resolve(entry.parentPath, entry.name));
    for (const [name, value] of privateValues) {
      if (content.includes(Buffer.from(value))) throw new Error(`Private environment value embedded in build: ${name}`);
    }
  }
}
console.log(`${production ? "Production" : "Preview"} build checked: expected routing and no embedded private environment values.`);

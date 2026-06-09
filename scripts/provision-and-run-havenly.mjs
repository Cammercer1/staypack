/**
 * Upsert Havenly tenant + run one delivery cycle (per havenly.json billing_mode).
 *
 * Targets NEXT_PUBLIC_SITE_URL / SITE_URL from .env.local (e.g. https://staypack.app).
 * DELIVERY_CRON_SECRET must match the deployed app's env.
 *
 * Usage: npx tsx scripts/provision-and-run-havenly.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function loadEnvLocal() {
  const path = resolve(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

/** Where POST /api/delivery/* runs (local dev until routes are deployed). */
const apiBase = (
  process.env.DELIVERY_API_BASE?.trim() || "http://localhost:3000"
).replace(/\/$/, "");

const publicSite = (
  process.env.SITE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
  apiBase
).replace(/\/$/, "");

const secret = process.env.DELIVERY_CRON_SECRET?.trim();
if (!secret) {
  console.error("DELIVERY_CRON_SECRET missing from .env.local");
  process.exit(1);
}

const configPath = resolve(ROOT, "lib/delivery/tenants/config/havenly.json");
const tenantConfig = JSON.parse(readFileSync(configPath, "utf8"));

async function assertServer() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const health = await fetch(`${apiBase}/`, {
      redirect: "follow",
      signal: controller.signal,
    }).catch(() => null);
    if (!health?.ok) {
      console.error(`App not reachable at ${apiBase}. Run: npm run dev`);
      console.error(
        "Tip: if port 3000 is stuck, run: lsof -i :3000 then kill that PID, or set DELIVERY_API_BASE=http://localhost:3003",
      );
      process.exit(1);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function parseJsonResponse(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    const snippet = text.replace(/\s+/g, " ").slice(0, 120);
    throw new Error(
      `${res.status} non-JSON from ${res.url} — deploy delivery routes or set DELIVERY_API_BASE=http://localhost:3000 (${snippet})`,
    );
  }
}

console.log("Havenly provision + run\n");
console.log("API base:", apiBase);
console.log("Public site (report links from server env):", publicSite);
console.log("Billing mode:", tenantConfig.billing_mode);
const perSource = tenantConfig.partner_sources?.map(
  (s) => `${s.label ?? s.url}: max_listings=${s.config?.max_listings ?? "(default 5)"}`,
);
console.log("Per-site cap:", perSource?.join("; ") ?? "none");
console.log(
  "Run cap (processed after discovery):",
  tenantConfig.feature_flags?.max_listings_per_run ?? "(default 1 when STR+lease)",
  "\n",
);

await assertServer();

console.log("1. Upserting tenant...");
const upsertRes = await fetch(`${apiBase}/api/delivery/tenants`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(tenantConfig),
});

const upsertBody = await parseJsonResponse(upsertRes);
if (!upsertRes.ok) {
  console.error("Upsert failed:", upsertRes.status, upsertBody);
  process.exit(1);
}
console.log("   Tenant:", upsertBody.slug ?? upsertBody);

console.log("\n2. Running delivery (may take 10–20 min for 3 listings × STR + lease)...\n");
/** Node fetch headers timeout is ~300s; use curl for long runs. */
const { execFileSync } = await import("node:child_process");
const curlOut = execFileSync(
  "curl",
  [
    "-sS",
    "-m",
    "1500",
    "-X",
    "POST",
    `${apiBase}/api/delivery/tenants/havenly/run`,
    "-H",
    `Authorization: Bearer ${secret}`,
  ],
  { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
);
const runBody = JSON.parse(curlOut);
const runRes = { ok: true, status: 200 };
console.log(JSON.stringify(runBody, null, 2));

if (!runRes.ok) {
  process.exit(1);
}

if (runBody.summary?.processedListings?.length) {
  console.log("\nProcessed listings:");
  for (const item of runBody.summary.processedListings) {
    console.log(" -", item.address);
    if (item.reports.str) {
      console.log("   STR:", item.reports.str.publicUrl);
    }
    if (item.reports.lease) {
      console.log("   Lease:", item.reports.lease.publicUrl);
    }
  }
}

console.log("\nDone.");

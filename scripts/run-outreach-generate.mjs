#!/usr/bin/env node
/**
 * Manual smoke test for POST /api/delivery/generate
 *
 * Usage:
 *   node scripts/run-outreach-generate.mjs --url "https://..." --tenant havenly
 *   node scripts/run-outreach-generate.mjs --url "https://..." --tenant havenly --deliverables str
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(filename) {
  try {
    const raw = readFileSync(resolve(process.cwd(), filename), "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // optional env file
  }
}

function loadEnv() {
  loadEnvFile(".env");
  loadEnvFile(".env.local");
}

function parseArgs(argv) {
  const args = {
    url: null,
    tenant: null,
    deliverables: ["str", "lease_appraisal", "sales_brochure"],
    baseUrl: process.env.SITE_URL ?? "http://localhost:3000",
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--url") args.url = argv[++i];
    else if (arg === "--tenant") args.tenant = argv[++i];
    else if (arg === "--base") args.baseUrl = argv[++i];
    else if (arg === "--deliverables") {
      args.deliverables = argv[++i].split(",").map((s) => s.trim());
    }
  }

  return args;
}

loadEnv();

const { url, tenant, deliverables, baseUrl } = parseArgs(process.argv);
const secret = process.env.DELIVERY_CRON_SECRET?.trim();

if (!url || !tenant) {
  console.error(
    "Usage: node scripts/run-outreach-generate.mjs --url <listing_url> --tenant <slug>",
  );
  process.exit(1);
}

if (!secret) {
  console.error("DELIVERY_CRON_SECRET is required in .env");
  process.exit(1);
}

const endpoint = `${baseUrl.replace(/\/$/, "")}/api/delivery/generate`;

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${secret}`,
  },
  body: JSON.stringify({
    tenant_slug: tenant,
    listing_url: url,
    deliverables,
  }),
});

const payload = await response.json();
console.log(JSON.stringify(payload, null, 2));
process.exit(response.ok ? 0 : 1);

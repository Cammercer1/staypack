import { execFileSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { expect, it } from "vitest";

// Run outside Vitest/Next so framework-only imports cannot be hidden by mocks.
it.each(["sales", "lease"])("the %s background worker starts in plain Node and rejects unsigned requests", async (kind) => {
  const directory = await mkdtemp(resolve(".worker-smoke-"));
  try {
    const outfile = resolve(directory, "worker.mjs");
    await build({
      entryPoints: [`netlify/functions/${kind}-appraisal-enrich-background.mts`],
      outfile,
      bundle: true,
      platform: "node",
      format: "esm",
      packages: "external",
      logLevel: "silent",
    });
    const script = `
      import assert from "node:assert/strict";
      import handler from ${JSON.stringify(pathToFileURL(outfile).href)};
      await assert.rejects(handler(new Request("https://example.test/background/${kind}-appraisal-enrich", {
        method: "POST", body: JSON.stringify({ jobId: "unsigned-job" })
      })), /Unauthorized/);
    `;
    expect(() => execFileSync(process.execPath, ["--input-type=module", "-e", script], { stdio: "pipe" })).not.toThrow();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it("keeps the credential-bearing property client out of browser bundles", async () => {
  await expect(build({
    entryPoints: ["lib/us-property/client.ts"],
    bundle: true,
    platform: "browser",
    write: false,
    logLevel: "silent",
  })).rejects.toThrow('Could not resolve "node:process"');
});

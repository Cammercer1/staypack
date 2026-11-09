import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { deferFrameworkMiddleware, wrapper } from "./defer.js";

test("defers evaluation but preserves the complete request, context and response", async () => {
  const directory = await mkdtemp(join(tmpdir(), "staypack-deferred-middleware-"));
  const key = `middleware${Date.now()}`;
  try {
    await writeFile(join(directory, "package.json"), '{"type":"module"}');
    await writeFile(join(directory, "entry.js"), wrapper);
    await writeFile(join(directory, "framework-entry.js"), `globalThis.${key} = (globalThis.${key} ?? 0) + 1;
      export default (request, context) => context.authorize(request);`);
    const { default: handler } = await import(pathToFileURL(join(directory, "entry.js")));
    assert.equal(globalThis[key], undefined);
    const request = new Request("https://staypack.app/dashboard");
    const response = new Response(null, { status: 307, headers: { location: "/login", "set-cookie": "auth=updated" } });
    let calls = 0;
    const context = { authorize: received => { assert.equal(received, request); calls++; return response; } };
    const results = await Promise.all([handler(request, context), handler(request, context)]);
    assert.deepEqual(results, [response, response]);
    assert.equal(calls, 2); assert.equal(globalThis[key], 1);
  } finally { delete globalThis[key]; await rm(directory, { recursive: true, force: true }); }
});

test("does not bypass authorization when middleware import fails", async () => {
  const directory = await mkdtemp(join(tmpdir(), "staypack-deferred-error-"));
  try {
    await writeFile(join(directory, "package.json"), '{"type":"module"}');
    await writeFile(join(directory, "entry.js"), wrapper);
    await writeFile(join(directory, "framework-entry.js"), 'throw new Error("framework unavailable");');
    const { default: handler } = await import(pathToFileURL(join(directory, "entry.js")));
    await assert.rejects(handler(new Request("https://staypack.app/dashboard"), {}), /framework unavailable/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("preserves the generated handler and matchers, refuses unrecognized adapters", async () => {
  const directory = await mkdtemp(join(tmpdir(), "staypack-deferred-build-"));
  const name = "___netlify-edge-handler-middleware";
  const entry = join(directory, name, `${name}.js`);
  const original = "import { handleMiddleware } from './edge-runtime/middleware.ts';\nimport handler from './server/middleware.js';\nexport default (req, context) => handleMiddleware(req, context, handler);";
  const manifest = JSON.stringify({ functions: [{ function: name, generator: "@netlify/plugin-nextjs@5.16.6", pattern: "/dashboard" }] });
  try {
    await mkdir(join(directory, name));
    await writeFile(join(directory, "manifest.json"), manifest);
    await writeFile(entry, original);
    await deferFrameworkMiddleware(directory);
    await deferFrameworkMiddleware(directory);
    assert.equal(await readFile(entry, "utf8"), wrapper);
    assert.equal(await readFile(join(directory, name, "framework-entry.js"), "utf8"), original);
    assert.equal(await readFile(join(directory, "manifest.json"), "utf8"), manifest);
    await writeFile(entry, original + "\nexport const config = {};");
    await assert.rejects(deferFrameworkMiddleware(directory), /unrecognized handler/);
    assert.equal(await readFile(entry, "utf8"), original + "\nexport const config = {};");
  } finally { await rm(directory, { recursive: true, force: true }); }
});

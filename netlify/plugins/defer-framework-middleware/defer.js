import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Netlify's stage-two bundle statically imports EVERY edge function, including
// middleware excluded by URL matchers. Defer only the generated framework entry;
// its original authorization and request/context handling still run unchanged.
const name = "___netlify-edge-handler-middleware";
const expected = `import { handleMiddleware } from './edge-runtime/middleware.ts';
import handler from './server/middleware.js';
export default (req, context) => handleMiddleware(req, context, handler);`;
const normalize = source => source.replace(/\s+/g, " ").trim();
export const wrapper = `// StayPack: load framework middleware only when its route is invoked.
let framework;
export default async function middleware(request, context) {
  framework ??= import('./framework-entry.js');
  const { default: handler } = await framework;
  return handler(request, context);
}
`;

export async function deferFrameworkMiddleware(directory) {
  const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
  const entries = manifest.functions.filter(entry => entry.function === name);
  if (!entries.length || entries.some(entry => !entry.generator?.startsWith("@netlify/plugin-nextjs@5."))) {
    throw new Error("Next middleware adapter changed; review the deferred middleware build plugin before deploying.");
  }
  const entryPath = join(directory, name, `${name}.js`);
  const source = await readFile(entryPath, "utf8");
  if (source === wrapper) return;
  // Do not silently discard future adapter exports, setup or configuration.
  if (normalize(source) !== normalize(expected)) {
    throw new Error("Next middleware entry changed; refusing to replace an unrecognized handler.");
  }
  await writeFile(join(directory, name, "framework-entry.js"), source);
  await writeFile(entryPath, wrapper);
}


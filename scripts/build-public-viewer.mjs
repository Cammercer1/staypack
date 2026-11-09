import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve, relative, basename } from "node:path";
import { createHash } from "node:crypto";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

const root = process.cwd(), directory = resolve(root, "public/_report-viewer");
const cloudflare = process.argv.includes("--cloudflare");
await rm(directory, { recursive: true, force: true });
await mkdir(directory, { recursive: true });
const aliases = { "next/image": resolve(root, "components/public-delivery/Image.tsx"), "next/dynamic": resolve(root, "components/public-delivery/dynamic.tsx") };
const client = await build({
  entryPoints: { viewer: "components/public-delivery/client.tsx" }, outdir: directory,
  bundle: true, splitting: true, format: "esm", platform: "browser", target: "es2022", minify: true,
  entryNames: "[name]-[hash]", chunkNames: "[name]-[hash]", assetNames: "[name]-[hash]",
  loader: { ".module.css": "local-css" }, alias: aliases, metafile: true,
  define: { "process.env.NODE_ENV": '"production"' }, logLevel: "warning",
});
const stylesheet = await postcss([tailwind()]).process(await readFile("app/globals.css", "utf8"), { from: resolve(root, "app/globals.css"), map: false });
const cssName = `base-${createHash("sha256").update(stylesheet.css).digest("hex").slice(0, 12)}.css`;
await writeFile(resolve(directory, cssName), stylesheet.css);
const entry = Object.entries(client.metafile.outputs).find(([, value]) => value.entryPoint === "components/public-delivery/client.tsx");
if (!entry) throw new Error("Public viewer entry was not emitted");
const assets = { script: `/_report-viewer/${basename(entry[0])}`, styles: [`/_report-viewer/${cssName}`, ...(entry[1].cssBundle ? [`/_report-viewer/${basename(entry[1].cssBundle)}`] : [])] };
await mkdir("netlify/edge-functions", { recursive: true });
const edge = await build({
  entryPoints: [cloudflare ? "lib/public-delivery/worker-entry.ts" : "lib/public-delivery/edge.ts"],
  outfile: cloudflare ? ".report-worker/worker.js" : "netlify/edge-functions/public-reports.js",
  bundle: true, format: "esm", platform: "browser", target: "es2022", minify: true, metafile: true,
  alias: aliases, plugins: [{ name: "server-only-edge", setup(builder) {
    builder.onResolve({ filter: /^server-only$/ }, () => ({ path: "server-only", namespace: "edge-marker" }));
    builder.onLoad({ filter: /.*/, namespace: "edge-marker" }, () => ({ contents: "export {};", loader: "js" }));
  } }],
  define: { "process.env.NODE_ENV": '"production"', PUBLIC_REPORT_ASSETS: JSON.stringify(assets),
    "process.env.NEXT_PUBLIC_SUPABASE_URL": cloudflare ? "PUBLIC_REPORT_ENV.NEXT_PUBLIC_SUPABASE_URL" : "PUBLIC_REPORT_ENV.url",
    "process.env.SUPABASE_SERVICE_ROLE_KEY": cloudflare ? "PUBLIC_REPORT_ENV.SUPABASE_SERVICE_ROLE_KEY" : "PUBLIC_REPORT_ENV.key" },
  banner: { js: cloudflare ? 'import { env as PUBLIC_REPORT_ENV } from "cloudflare:workers";' : 'const PUBLIC_REPORT_ENV = {url: Netlify.env.get("NEXT_PUBLIC_SUPABASE_URL"), key: Netlify.env.get("SUPABASE_SERVICE_ROLE_KEY")};' }, logLevel: "warning",
});
// A private reader reaching the browser, or Next's server reaching the edge, defeats the boundary.
if (Object.keys(client.metafile.inputs).some(path => /supabase\/rest|\/published\.ts|public-delivery\/handler/.test(path))) throw new Error("Private code reached the public viewer");
if (Object.keys(edge.metafile.inputs).some(path => /node_modules\/next\//.test(path))) throw new Error("Next server reached the edge bundle");
await mkdir(".netlify/public-viewer", { recursive: true });
await writeFile(".netlify/public-viewer/assets.json", JSON.stringify(assets));
await writeFile(".netlify/public-viewer/build.json", JSON.stringify({ client: client.metafile, edge: edge.metafile }));
console.log(`Public viewer built: ${relative(root, resolve(entry[0]))}; edge ${(Object.values(edge.metafile.outputs)[0].bytes / 1024).toFixed(0)} KB`);
if (cloudflare) {
  const assetDirectory = resolve(root, ".report-worker/assets");
  await rm(assetDirectory, { recursive: true, force: true });
  await mkdir(assetDirectory, { recursive: true });
  for (const name of ["_report-viewer", "fonts", "brands"]) await cp(resolve(root, "public", name), resolve(assetDirectory, name), { recursive: true });
  await writeFile(resolve(assetDirectory, "_headers"), "/_report-viewer/*\n  Cache-Control: public, max-age=31536000, immutable\n/fonts/*\n  Cache-Control: public, max-age=86400\n/brands/*\n  Cache-Control: public, max-age=3600\n");
}

import { lookup } from "node:dns/promises";
import { request as httpRequest, type IncomingMessage } from "node:http";
import { request as httpsRequest } from "node:https";
import { BlockList, isIP } from "node:net";

const MAX_BYTES = 12 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 3;
const redirects = new Set([301, 302, 303, 307, 308]);

const nonPublicV4 = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
  ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) nonPublicV4.addSubnet(address, prefix, "ipv4");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");
const nonPublicV6 = new BlockList();
for (const [address, prefix] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]] as const) {
  nonPublicV6.addSubnet(address, prefix, "ipv6");
}

function isPublicAddress(address: string) {
  const family = isIP(address);
  return family === 4 ? !nonPublicV4.check(address, "ipv4")
    : family === 6 && globalV6.check(address, "ipv6") && !nonPublicV6.check(address, "ipv6");
}

function imageUrl(value: string, base?: URL) {
  let url: URL;
  try { url = new URL(value, base); } catch { throw new Error("Invalid image URL"); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Invalid image URL");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "").toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || (isIP(hostname) && !isPublicAddress(hostname))) {
    throw new Error("Image host not allowed");
  }
  return url;
}

/** DNS cannot be cancelled, but the deadline must still finish a stalled lookup. */
async function beforeAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  signal.throwIfAborted();
  let abort: () => void = () => {};
  try {
    return await Promise.race([promise, new Promise<never>((_, reject) => {
      abort = () => reject(signal.reason);
      signal.addEventListener("abort", abort, { once: true });
    })]);
  } finally { signal.removeEventListener("abort", abort); }
}

async function requestImage(url: URL, signal: AbortSignal): Promise<IncomingMessage> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const family = isIP(hostname);
  const addresses = family ? [{ address: hostname, family }]
    : await beforeAbort(lookup(hostname, { all: true, verbatim: true }), signal);
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) {
    throw new Error("Image host not allowed");
  }
  signal.throwIfAborted();
  // Pin the checked address to the socket. A second DNS lookup would permit rebinding.
  // Prefer IPv4 where available; the serverless runtime may have no IPv6 egress.
  const address = addresses.find(item => item.family === 4) ?? addresses[0];
  return new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? httpsRequest : httpRequest)(url, {
      agent: false,
      family: address.family,
      lookup: (_hostname, options, callback) => {
        if (options.all) callback(null, [address]);
        else callback(null, address.address, address.family);
      },
      signal,
      headers: { Accept: "image/*", "Accept-Encoding": "identity", "User-Agent": "StayPack/1.0 (+https://staypack.app)" },
    }, resolve);
    request.on("error", reject);
    request.end();
  });
}

/** Authenticated image proxy: only public destinations, bounded redirects and body. */
export async function fetchExportImage(value: string, signal?: AbortSignal) {
  let target = imageUrl(value);
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) abort();
  const timeout = setTimeout(() => controller.abort(new Error("Image request timed out")), FETCH_TIMEOUT_MS);
  try {
    for (let followed = 0; ; followed++) {
      const response = await requestImage(target, controller.signal);
      const abortResponse = () => response.destroy(controller.signal.reason);
      controller.signal.addEventListener("abort", abortResponse, { once: true });
      try {
        controller.signal.throwIfAborted();
        const status = response.statusCode ?? 0;
        if (redirects.has(status)) {
          if (followed >= MAX_REDIRECTS || !response.headers.location) throw new Error("Image redirected too many times");
          target = imageUrl(response.headers.location, target);
          continue;
        }
        if (status < 200 || status >= 300) throw new Error(`Image fetch failed (${status})`);
        const contentType = response.headers["content-type"] ?? "application/octet-stream";
        if (!contentType.toLowerCase().startsWith("image/")) throw new Error("URL did not return an image");
        if (response.headers["content-encoding"] && response.headers["content-encoding"] !== "identity") {
          throw new Error("Image server returned an unsupported encoding");
        }
        if (Number(response.headers["content-length"]) > MAX_BYTES) throw new Error("Image is too large");
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of response) {
          controller.signal.throwIfAborted();
          const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += bytes.length;
          if (size > MAX_BYTES) throw new Error("Image is too large");
          chunks.push(bytes);
        }
        if (!size) throw new Error("Image is empty");
        return { buffer: Buffer.concat(chunks, size), contentType };
      } finally {
        controller.signal.removeEventListener("abort", abortResponse);
        response.destroy();
      }
    }
  } catch (error) {
    if (controller.signal.aborted) throw controller.signal.reason;
    throw error;
  } finally { clearTimeout(timeout); signal?.removeEventListener("abort", abort); }
}

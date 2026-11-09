import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { fetchExportImage } from "./fetchExportImage";
const request = vi.fn();
beforeEach(() => { vi.stubEnv("CLOUDFLARE_APP", "1"); vi.stubGlobal("fetch", request); request.mockReset(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("checks every redirect and never sends a request to a private address", async () => {
  request.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "http://169.254.169.254/image" } }));
  await expect(fetchExportImage("https://images.example/image")).rejects.toThrow("Image host not allowed");
  expect(request).toHaveBeenCalledTimes(1);
  expect(request.mock.calls[0][1].redirect).toBe("manual");
});
it("reads public images and rejects streamed bodies over the limit", async () => {
  request.mockResolvedValueOnce(new Response("image", { headers: { "content-type": "image/png" } }));
  expect((await fetchExportImage("https://images.example/image")).buffer.toString()).toBe("image");
  request.mockResolvedValueOnce(new Response(new Uint8Array(12 * 1024 * 1024 + 1), { headers: { "content-type": "image/png", "content-length": "1" } }));
  await expect(fetchExportImage("https://images.example/image")).rejects.toThrow("Image is too large");
});
it("aborts a stalled image body", async () => {
  const abort = new AbortController();
  request.mockResolvedValueOnce(new Response(new ReadableStream(), { headers: { "content-type": "image/png" } }));
  const result = expect(fetchExportImage("https://images.example/image", abort.signal)).rejects.toThrow("cancelled");
  abort.abort(new Error("cancelled"));
  await result;
});

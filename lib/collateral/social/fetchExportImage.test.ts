import { EventEmitter } from "node:events";
import type { ClientRequest, IncomingMessage, RequestOptions } from "node:http";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchExportImage } from "./fetchExportImage";

const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:http", () => ({ request: mocks.request }));
vi.mock("node:https", () => ({ request: mocks.request }));

type ResponsePlan = { status?: number; headers?: Record<string, string>; chunks?: Buffer[]; stalled?: boolean };
let plans: ResponsePlan[];
let responses: IncomingMessage[];
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  plans = [{}]; responses = [];
  mocks.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  mocks.request.mockImplementation((_url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) => {
    const request = new EventEmitter() as ClientRequest;
    const plan = plans.shift() ?? {};
    request.end = vi.fn(() => {
      const stream = new PassThrough();
      const response = stream as unknown as IncomingMessage;
      response.statusCode = plan.status ?? 200;
      response.headers = { "content-type": "image/png", ...plan.headers };
      responses.push(response);
      const abort = () => response.destroy(options.signal?.reason);
      options.signal?.addEventListener("abort", abort, { once: true });
      response.on("close", () => options.signal?.removeEventListener("abort", abort));
      callback(response);
      for (const chunk of plan.chunks ?? [Buffer.from("PNG image")]) stream.write(chunk);
      if (!plan.stalled) stream.end();
      return request;
    });
    return request;
  });
});
afterEach(() => { for (const response of responses) response.destroy(); vi.useRealTimers(); });

describe("public image destinations", () => {
  it.each([
    "http://localhost/image", "http://localhost./image", "http://images.localhost/image",
    "http://127.0.0.2/image", "http://2130706433/image", "http://0x7f000001/image",
    "http://169.254.169.254/image", "http://10.1.2.3/image", "http://172.16.2.3/image",
    "http://192.168.1.2/image", "http://100.64.0.1/image", "http://0.1.2.3/image",
    "http://[::1]/image", "http://[::ffff:127.0.0.1]/image", "http://[fd00::1]/image",
    "http://[fe80::1]/image", "http://[2002:7f00:1::]/image", "file:///etc/passwd",
    "https://user:password@images.example/image",
  ])("rejects %s before DNS or HTTP", async url => {
    await expect(fetchExportImage(url)).rejects.toThrow(/Image host not allowed|Invalid image URL/);
    expect(mocks.lookup).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it.each([
    [{ address: "127.0.0.1", family: 4 }],
    [{ address: "::1", family: 6 }],
    [{ address: "93.184.216.34", family: 4 }, { address: "10.1.2.3", family: 4 }],
    [],
  ])("rejects private or mixed DNS answers before HTTP", async (...args) => {
    mocks.lookup.mockResolvedValue(args);
    await expect(fetchExportImage("https://images.example/photo.png")).rejects.toThrow("Image host not allowed");
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("pins the checked IP while retaining the original URL for Host and TLS", async () => {
    mocks.lookup.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }])
      .mockResolvedValue([{ address: "127.0.0.1", family: 4 }]);
    const result = await fetchExportImage("https://images.example/photo.png?width=1000");
    expect(result.buffer.toString()).toBe("PNG image");
    expect(result.contentType).toBe("image/png");
    const [url, options] = mocks.request.mock.calls[0] as [URL, RequestOptions];
    expect(url.href).toBe("https://images.example/photo.png?width=1000");
    expect(options.agent).toBe(false);
    const callback = vi.fn();
    options.lookup!("images.example", {}, callback);
    expect(callback).toHaveBeenCalledExactlyOnceWith(null, "93.184.216.34", 4);
    expect(mocks.lookup).toHaveBeenCalledTimes(1);
    expect(responses[0].destroyed).toBe(true);
  });

  it.each(["http://172.40.1.1/photo.jpg", "https://[2606:4700::1111]/photo.jpg"])("allows public literal %s", async url => {
    await expect(fetchExportImage(url)).resolves.toMatchObject({ contentType: "image/png" });
    expect(mocks.lookup).not.toHaveBeenCalled();
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });

  it("allows public IPv6 DNS results", async () => {
    mocks.lookup.mockResolvedValue([{ address: "2606:4700::1111", family: 6 }]);
    await expect(fetchExportImage("https://images.example/photo.png")).resolves.toMatchObject({ contentType: "image/png" });
    expect(mocks.request.mock.calls[0][1].family).toBe(6);
  });
});

describe("redirects", () => {
  it("follows relative and public CDN redirects, checking each destination", async () => {
    plans = [{ status: 302, headers: { location: "/resized/photo.png" } },
      { status: 307, headers: { location: "https://cdn.example/photo.png" } }, {}];
    const result = await fetchExportImage("https://images.example/photo.png");
    expect(result.buffer.toString()).toBe("PNG image");
    expect(mocks.request.mock.calls.map(([url]) => url.href)).toEqual([
      "https://images.example/photo.png", "https://images.example/resized/photo.png", "https://cdn.example/photo.png",
    ]);
    expect(mocks.lookup.mock.calls.map(([host]) => host)).toEqual(["images.example", "images.example", "cdn.example"]);
    expect(responses.every(response => response.destroyed)).toBe(true);
  });

  it.each(["http://[::1]/image", "http://169.254.169.254/image", "file:///etc/passwd", "https://user:pass@cdn.example/image"])("blocks redirect to %s", async location => {
    plans = [{ status: 302, headers: { location } }];
    await expect(fetchExportImage("https://images.example/photo.png")).rejects.toThrow();
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });

  it("blocks a CDN name that resolves privately after redirect", async () => {
    plans = [{ status: 302, headers: { location: "https://cdn.example/photo.png" } }];
    mocks.lookup.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }])
      .mockResolvedValueOnce([{ address: "10.0.0.1", family: 4 }]);
    await expect(fetchExportImage("https://images.example/photo.png")).rejects.toThrow("Image host not allowed");
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });

  it("bounds a redirect loop", async () => {
    plans = Array.from({ length: 5 }, () => ({ status: 302, headers: { location: "/image" } }));
    await expect(fetchExportImage("https://images.example/image")).rejects.toThrow("Image redirected too many times");
    expect(mocks.request).toHaveBeenCalledTimes(4);
  });
});

describe("bounded image body", () => {
  it("rejects a declared oversized image before buffering", async () => {
    plans = [{ headers: { "content-length": String(12 * 1024 * 1024 + 1) }, chunks: [], stalled: true }];
    await expect(fetchExportImage("https://images.example/image")).rejects.toThrow("Image is too large");
    expect(responses[0].destroyed).toBe(true);
  });

  it("stops an oversized streamed image even when Content-Length lies", async () => {
    plans = [{ headers: { "content-length": "1" }, chunks: [Buffer.alloc(12 * 1024 * 1024), Buffer.from("x")], stalled: true }];
    await expect(fetchExportImage("https://images.example/image")).rejects.toThrow("Image is too large");
    expect(responses[0].destroyed).toBe(true);
  });

  it("times out a stalled body after its headers have already arrived", async () => {
    plans = [{ chunks: [Buffer.from("partial")], stalled: true }];
    const result = expect(fetchExportImage("https://images.example/image")).rejects.toThrow("Image request timed out");
    await vi.advanceTimersByTimeAsync(20_001);
    await result;
    expect(responses[0].destroyed).toBe(true);
  });

  it("includes DNS resolution in the same deadline and never opens a late connection", async () => {
    let finish!: (value: { address: string; family: number }[]) => void;
    mocks.lookup.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const result = expect(fetchExportImage("https://images.example/image")).rejects.toThrow("Image request timed out");
    await vi.advanceTimersByTimeAsync(20_001);
    await result;
    finish([{ address: "93.184.216.34", family: 4 }]);
    await Promise.resolve();
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: 404 }, "Image fetch failed (404)"],
    [{ headers: { "content-type": "text/html" } }, "URL did not return an image"],
    [{ chunks: [] }, "Image is empty"],
  ] as const)("rejects unusable upstream response", async (plan, message) => {
    plans = [plan as ResponsePlan];
    await expect(fetchExportImage("https://images.example/image")).rejects.toThrow(message);
    expect(responses[0].destroyed).toBe(true);
  });
});

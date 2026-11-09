import { beforeEach, expect, it, vi } from "vitest";
import { rasterizeSvg } from "./screenshot";
const request = vi.hoisted(() => vi.fn());
vi.mock("./client", () => ({ browserlessRequest: request }));
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1XQAAAAASUVORK5CYII=", "base64");
beforeEach(() => { vi.clearAllMocks(); request.mockResolvedValue(png); });
it("renders SVG in an isolated image with a transparent background", async () => {
  const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="20"><rect width="10" height="20"/></svg>');
  expect(await rasterizeSvg(svg, 10, 20)).toEqual(png);
  const body = request.mock.calls[0][1];
  expect(body.html).toContain("default-src 'none'; img-src data:");
  expect(body.html).not.toContain("<svg");
  expect(body.viewport).toEqual({ width: 15, height: 30, deviceScaleFactor: 1 });
  expect(body.options.omitBackground).toBe(true);
});
it("rejects oversized images and non-PNG responses", async () => {
  await expect(rasterizeSvg(Buffer.alloc(0), 10000, 10000)).rejects.toThrow("dimensions");
  expect(request).not.toHaveBeenCalled();
  request.mockResolvedValue(Buffer.from("error page"));
  await expect(rasterizeSvg(Buffer.alloc(0), 10, 10)).rejects.toThrow("PNG");
});

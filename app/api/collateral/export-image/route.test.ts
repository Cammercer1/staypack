import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ requireAgency: vi.fn(), image: vi.fn() }));
vi.mock("@/lib/auth/requireUser", () => ({ requireAgency: mocks.requireAgency }));
vi.mock("@/lib/collateral/social/fetchExportImage", () => ({ fetchExportImage: mocks.image }));
const request = (url = "https://images.example/photo.png") => new Request(`https://staypack.app/api/collateral/export-image?url=${encodeURIComponent(url)}`);
beforeEach(() => { vi.resetAllMocks(); mocks.requireAgency.mockResolvedValue({}); });

it("requires agency access before any remote request", async () => {
  mocks.requireAgency.mockRejectedValue(new Error("Unauthorized"));
  expect((await GET(request())).status).toBe(400);
  expect(mocks.image).not.toHaveBeenCalled();
});

it("returns a public image privately with active-content protection", async () => {
  mocks.image.mockResolvedValue({ buffer: Buffer.from("image bytes"), contentType: "image/png" });
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(await response.text()).toBe("image bytes");
  expect(response.headers.get("content-type")).toBe("image/png");
  expect(response.headers.get("cache-control")).toBe("private, no-store, max-age=0");
  expect(response.headers.get("content-security-policy")).toContain("sandbox");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
});

it("returns a recoverable error for unsafe or timed-out images", async () => {
  mocks.image.mockRejectedValue(new Error("Image host not allowed"));
  const response = await GET(request());
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "Image host not allowed" });
});

it("requires an image URL", async () => {
  expect((await GET(new Request("https://staypack.app/api/collateral/export-image"))).status).toBe(400);
  expect(mocks.image).not.toHaveBeenCalled();
});

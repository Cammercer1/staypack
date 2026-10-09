import { afterEach, expect, it, vi } from "vitest";
import { validateBrandAsset, uploadBrandAsset } from "./assetUpload";
import { POST } from "@/app/api/agencies/upload-asset/route";
const mocks = vi.hoisted(() => ({ upload: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/auth/requireUser", () => ({ requireAgencyAdmin: mocks.auth }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        upload: mocks.upload,
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://assets.example/${path}` },
        }),
      }),
    },
  }),
}));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it.each([
  [{ name: "logo.gif", type: "image/gif", size: 100 }, "logo", "PNG"],
  [
    { name: "logo.png", type: "image/png", size: 6 * 1024 * 1024 },
    "logo",
    "5 MB",
  ],
  [
    { name: "font.exe", type: "application/octet-stream", size: 100 },
    "font",
    "WOFF",
  ],
  [
    { name: "font.woff2", type: "font/woff2", size: 11 * 1024 * 1024 },
    "font",
    "10 MB",
  ],
  [{ name: "font.ttf", type: "", size: 0 }, "font", "empty"],
] as const)("validates asset format and size", (file, type, expected) => {
  expect(validateBrandAsset(file, type)).toContain(expected);
});
it("accepts font files with missing browser MIME metadata", () =>
  expect(
    validateBrandAsset(
      { name: "font.woff2", type: "", size: 100 },
      "heading-font",
    ),
  ).toBeNull());
it("reports unreadable upload responses without returning an invalid URL", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error("Invalid JSON");
      },
    }),
  );
  await expect(
    uploadBrandAsset(
      new File(["logo"], "logo.svg", { type: "image/svg+xml" }),
      "logo",
    ),
  ).rejects.toThrow("Upload failed");
});
async function request(
  file = new File(["logo"], "logo.svg", { type: "image/svg+xml" }),
  type = "logo-dark",
) {
  const body = new FormData();
  body.append("file", file);
  body.append("type", type);
  return POST(
    new Request("http://localhost/api/agencies/upload-asset", {
      method: "POST",
      body,
    }),
  );
}
it("creates unique immutable asset URLs for consecutive replacements", async () => {
  mocks.auth.mockResolvedValue({ agency: { id: "agency-1" } });
  mocks.upload.mockResolvedValue({ error: null });
  const first = await (await request()).json();
  const second = await (await request()).json();
  expect(first.path).toMatch(/^agency-1\/logo-dark-.+\.svg$/);
  expect(first.path).not.toBe(second.path);
  expect(mocks.upload.mock.calls[0][2].upsert).toBe(false);
});
it("rejects unsupported files before storage and requires an admin", async () => {
  mocks.auth.mockResolvedValue({ agency: { id: "agency-1" } });
  expect(
    (await request(new File(["bad"], "logo.gif", { type: "image/gif" })))
      .status,
  ).toBe(400);
  expect(mocks.upload).not.toHaveBeenCalled();
  mocks.auth.mockRejectedValue(new Error("Admin access required"));
  expect((await (await request()).json()).error).toBe("Admin access required");
  expect(mocks.upload).not.toHaveBeenCalled();
});
it("returns a recoverable storage failure", async () => {
  mocks.auth.mockResolvedValue({ agency: { id: "agency-1" } });
  mocks.upload.mockResolvedValue({ error: { message: "Storage unavailable" } });
  const response = await request();
  expect(response.status).toBe(400);
  expect((await response.json()).error).toBe("Storage unavailable");
});

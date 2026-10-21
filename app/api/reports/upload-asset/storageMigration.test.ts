import { beforeEach, expect, it, vi } from "vitest";
import { POST as sign } from "./sign/route";
import { POST as finalize } from "./finalize/route";
import { requireListingAccess, requireReportWithListing } from "@/lib/auth/requireUser";
import { signR2ImageUpload, verifyR2ImageUpload } from "@/lib/storage/signedUpload";

vi.mock("@/lib/auth/requireUser", () => ({ requireListingAccess: vi.fn(), requireReportWithListing: vi.fn() }));
vi.mock("@/lib/storage/r2", () => ({ usesR2Storage: () => true }));
vi.mock("@/lib/storage/signedUpload", () => ({ signR2ImageUpload: vi.fn(), verifyR2ImageUpload: vi.fn() }));
const update = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }));
const oldSign = vi.fn(async () => ({ data: { token: "old-token", signedUrl: "https://old.example.com/upload" }, error: null }));
const request = (body: unknown) => new Request("https://staypack.app/api/reports/upload-asset", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  const access = { agency: { id: "agency-a" }, listing: { id: "listing-a", uploaded_image_urls: ["https://old.example.com/keep.jpg"] }, supabase: {
    storage: { from: () => ({ createSignedUploadUrl: oldSign, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://old.example.com/${path}` } }) }) },
    from: () => ({ update }),
  } } as unknown as Awaited<ReturnType<typeof requireListingAccess>>;
  vi.mocked(requireListingAccess).mockResolvedValue(access);
  vi.mocked(signR2ImageUpload).mockImplementation(async (path) => ({ path, publicUrl: `https://assets.staypack.app/report-assets/${path}`, provider: "r2", signedUrl: "https://r2.example.com/upload" }));
  vi.mocked(verifyR2ImageUpload).mockImplementation(async path => `https://assets.staypack.app/report-assets/${path}`);
});

it("authorizes the listing and signs the optimized image's exact type and size", async () => {
  const response = await sign(request({ listing_id: "listing-a", storage_protocol: 2, files: [{ name: "photo.webp", type: "image/webp", size: 4567 }] }));
  expect(response.status).toBe(200);
  expect(requireListingAccess).toHaveBeenCalledWith("listing-a");
  expect(signR2ImageUpload).toHaveBeenCalledWith(expect.stringMatching(/^agency-a\/listing-a\/[\da-f-]+\.webp$/), "image/webp", 4567);
  expect(oldSign).not.toHaveBeenCalled();
});

it("lets an already-open older client finish its Supabase upload", async () => {
  const response = await sign(request({ listing_id: "listing-a", files: [{ name: "photo.jpg", type: "image/jpeg" }] }));
  expect(response.status).toBe(200);
  expect((await response.json()).uploads[0]).toMatchObject({ provider: "supabase", token: "old-token" });
  expect(signR2ImageUpload).not.toHaveBeenCalled();
});

it("does not grant storage access when report authorization fails", async () => {
  vi.mocked(requireReportWithListing).mockRejectedValueOnce(new Error("Forbidden"));
  expect((await sign(request({ report_id: "another-report", storage_protocol: 2, files: [{ type: "image/jpeg", size: 123 }] }))).status).toBe(400);
  expect(signR2ImageUpload).not.toHaveBeenCalled();
  expect(oldSign).not.toHaveBeenCalled();
});

it.each(["other-agency/listing-a/photo.jpg", "agency-a/other-listing/photo.jpg", "agency-a/listing-a/../photo.jpg", "agency-a/listing-a/sub/photo.jpg"])("rejects an upload outside its authorized listing: %s", async path => {
  expect((await finalize(request({ listing_id: "listing-a", uploads: [{ path, provider: "r2" }] }))).status).toBe(400);
  expect(verifyR2ImageUpload).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});

it("requires the R2 object to exist before saving a URL", async () => {
  vi.mocked(verifyR2ImageUpload).mockRejectedValueOnce(new Error("Missing object"));
  expect((await finalize(request({ listing_id: "listing-a", uploads: [{ path: "agency-a/listing-a/photo.jpg", provider: "r2" }] }))).status).toBe(400);
  expect(update).not.toHaveBeenCalled();
});

it("preserves legacy image URLs when adding a verified R2 image", async () => {
  const response = await finalize(request({ listing_id: "listing-a", uploads: [{ path: "agency-a/listing-a/photo.jpg", provider: "r2" }] }));
  expect(response.status).toBe(200);
  expect(update).toHaveBeenCalledWith({ uploaded_image_urls: ["https://old.example.com/keep.jpg", "https://assets.staypack.app/report-assets/agency-a/listing-a/photo.jpg"] });
});

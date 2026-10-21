import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { preserveProposalImages } from "./imageStorage";
import { proposalImageUrls, replaceProposalImages } from "./imageSnapshot";

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), send: vi.fn() }));
vi.mock("../collateral/social/fetchExportImage", () => ({ fetchExportImage: mocks.fetch }));
vi.mock("../storage/r2", () => ({
  usesR2Storage: () => true, r2Client: () => ({ send: mocks.send }),
  storageObject: (_bucket: string, path: string) => ({ Bucket: "public", Key: `report-assets/${path}` }),
  r2PublicUrl: (_bucket: string, path: string) => `https://assets.test/report-assets/${path}`,
}));
const scope = "a".repeat(36);
const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1XQAAAAASUVORK5CYII=", "base64");
const hash = createHash("sha256").update(bytes).digest("hex");
const url = `https://assets.test/report-assets/${scope}/published-images/${hash}.png`;
beforeEach(() => { vi.clearAllMocks(); mocks.fetch.mockResolvedValue({ buffer: bytes, contentType: "image/png" }); mocks.send.mockResolvedValue({}); });

it("replaces every presentation image field, deduplicates downloads and leaves links, copy and input untouched", async () => {
  const source = "https://source.test/photo";
  const snapshot = { data: { property: { heroImageUrl: source, gallery: [source, ""] }, agency: { logoUrl: source }, agents: [{ photoUrl: source }], comparables: [{ imageUrl: source }], appraisal: { comparables: [{ imageUrl: source }] } },
    draft: { propertyImages: { heroImageUrl: source, gallery: [source] }, pages: [{ service: { imageUrl: source, platforms: [{ imageUrl: source }], imageCaption: source } }], links: [{ url: source }] },
    pdfReport: { property: { hero_image_url: source, selected_image_urls: [source], listing_url: source }, agency: { logo_url: source, logo_light_url: source, logo_dark_url: source, font_file_url: source }, agent: { photo_url: source }, str_enrichment: { comps: [{ thumbnail_url: source }] } } };
  const frozen = await preserveProposalImages(snapshot, scope);
  expect(proposalImageUrls(frozen)).toEqual([url]);
  expect(frozen.draft.propertyImages).toEqual({ heroImageUrl: url, gallery: [url] });
  expect(frozen.data.property.heroImageUrl).toBe(frozen.pdfReport.property.hero_image_url);
  expect(frozen.draft.links[0].url).toBe(source);
  expect(frozen.draft.pages[0].service.imageCaption).toBe(source);
  expect(frozen.pdfReport.property.listing_url).toBe(source);
  expect(frozen.pdfReport.agency.font_file_url).toBe(source);
  expect(proposalImageUrls(snapshot)).toEqual([source]);
  expect(mocks.fetch).toHaveBeenCalledTimes(2);
  expect(mocks.send.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
  expect(mocks.send.mock.calls[0][0].input).toMatchObject({ IfNoneMatch: "*", Metadata: { sha256: hash } });
});

it("never returns a partially rewritten snapshot when an image or its readback fails", async () => {
  mocks.fetch.mockRejectedValueOnce(new Error("source removed"));
  const snapshot = { heroImageUrl: "https://source.test/gone" };
  await expect(preserveProposalImages(snapshot, scope)).rejects.toThrow("source removed");
  expect(snapshot.heroImageUrl).toBe("https://source.test/gone");
  expect(mocks.send).not.toHaveBeenCalled();
  mocks.fetch.mockResolvedValueOnce({ buffer: bytes, contentType: "image/png" }).mockResolvedValueOnce({ buffer: Buffer.from("wrong"), contentType: "image/png" });
  await expect(preserveProposalImages(snapshot, scope)).rejects.toThrow("checksum mismatch");
  expect(() => replaceProposalImages(snapshot, new Map())).toThrow("not been preserved");
});

it("verifies existing immutable copies without overwriting them and accepts only verified collision retries", async () => {
  expect(await preserveProposalImages({ heroImageUrl: url }, scope)).toEqual({ heroImageUrl: url });
  expect(mocks.send).not.toHaveBeenCalled();
  mocks.send.mockRejectedValueOnce({ $metadata: { httpStatusCode: 412 } });
  expect(await preserveProposalImages({ heroImageUrl: "/photo.png" }, scope)).toEqual({ heroImageUrl: url });
  expect(mocks.fetch).toHaveBeenCalledWith("https://staypack.app/photo.png", expect.any(AbortSignal));
  mocks.send.mockRejectedValueOnce({ $metadata: { httpStatusCode: 403 } });
  await expect(preserveProposalImages({ heroImageUrl: "/photo.png" }, scope)).rejects.toBeDefined();
});

it("can recover historical images from verified PDF mirrors without contacting their expired source", async () => {
  const recover = vi.fn().mockResolvedValue({ buffer: bytes, contentType: "image/png" });
  expect(await preserveProposalImages({ heroImageUrl: "https://expired.test/photo" }, scope, { recover })).toEqual({ heroImageUrl: url });
  expect(mocks.fetch).toHaveBeenCalledTimes(1);
  expect(mocks.fetch.mock.calls[0][0]).toBe(url);
});

it("rejects non-image bytes and unsafe scopes before publication", async () => {
  await expect(preserveProposalImages({}, "../private")).rejects.toThrow("scope");
  mocks.fetch.mockResolvedValueOnce({ buffer: Buffer.from("<html>not a photo</html>"), contentType: "image/png" });
  await expect(preserveProposalImages({ logoUrl: "https://source.test/logo" }, scope)).rejects.toThrow();
  expect(mocks.send).not.toHaveBeenCalled();
});

it("rasterizes self-contained SVGs but rejects active content and external resources", async () => {
  const svg = '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><defs><linearGradient id="g"><stop stop-color="red"/></linearGradient></defs><rect width="2" height="2" fill="url(\'#g\')"/></svg>';
  mocks.fetch.mockImplementation(async (source: string) => source.includes("source.test")
    ? { buffer: Buffer.from(svg), contentType: "image/svg+xml" }
    : { buffer: mocks.send.mock.calls[0][0].input.Body, contentType: "image/png" });
  const frozen = await preserveProposalImages({ logoUrl: "https://source.test/logo.svg" }, scope);
  expect(frozen.logoUrl).toMatch(/\.png$/);
  expect(mocks.send.mock.calls[0][0].input.ContentType).toBe("image/png");
  for (const content of ['<image href="https://external.test/image"/>', '<script>alert(1)</script>', '<style>@import "https://external.test/style";</style>']) {
    mocks.fetch.mockResolvedValueOnce({ buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2">${content}</svg>`), contentType: "image/svg+xml" });
    await expect(preserveProposalImages({ logoUrl: "https://source.test/unsafe.svg" }, scope)).rejects.toThrow("external or active");
  }
});

it("aborts a stalled image fetch at the publication deadline", async () => {
  mocks.fetch.mockImplementation((_source: string, signal: AbortSignal) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  }));
  await expect(preserveProposalImages({ heroImageUrl: "https://source.test/stalled" }, scope, { timeoutMs: 10 })).rejects.toThrow("timed out");
  expect(mocks.send).not.toHaveBeenCalled();
});

it("keeps raster bytes intact when embedded metadata contains SVG text", async () => {
  const raster = Buffer.concat([bytes, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://metadata.test/preview"/></svg>')]);
  mocks.fetch.mockResolvedValue({ buffer: raster, contentType: "image/png" });
  const frozen = await preserveProposalImages({ heroImageUrl: "https://source.test/metadata.png" }, scope);
  expect(frozen.heroImageUrl).toContain(createHash("sha256").update(raster).digest("hex"));
  expect(mocks.send.mock.calls[0][0].input.Body).toEqual(raster);
});

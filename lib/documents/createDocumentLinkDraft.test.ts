import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ upload: vi.fn(), qr: vi.fn(), admin: vi.fn() }));
vi.mock("@/lib/reports/qr", () => ({ generateQrCodeBuffer: mocks.qr }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
import { createDocumentLinkDraft } from "./createDocumentLinkDraft";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.qr.mockResolvedValue(Buffer.from("qr"));
  mocks.upload.mockResolvedValue({ error: null });
  mocks.admin.mockReturnValue({ storage: { from: () => ({ upload: mocks.upload, getPublicUrl: (path: string) => ({ data: { publicUrl: `https://assets.example/${path}` } }) }) } });
});
describe("server QR generation", () => {
  it("creates no assets or client when QR is off", async () => {
    expect(await createDocumentLinkDraft({ link: { mode: "none" }, agencyId: "a", documentId: "r" })).toEqual({ link: { mode: "none" }, target_url: "", qr_code_url: "" });
    expect(mocks.admin).not.toHaveBeenCalled();
    expect(mocks.qr).not.toHaveBeenCalled();
  });
  it.each(["https://example.com/a", "https://example.com/b?property=42#photos"])("encodes the exact document URL %s", async (url) => {
    const draft = await createDocumentLinkDraft({ link: { mode: "custom", url }, agencyId: "a", documentId: "r" });
    expect(mocks.qr).toHaveBeenCalledWith(url);
    expect(draft.target_url).toBe(url);
    expect(mocks.upload.mock.calls[0][0]).toMatch(/^a\/r\/qr-.+\.png$/);
  });
  it("encodes an online report, without a listing redirect", async () => {
    await createDocumentLinkDraft({ link: { mode: "report" }, agencyId: "a", documentId: "r", reportUrl: "https://staypack.app/agency/report" });
    expect(mocks.qr).toHaveBeenCalledWith("https://staypack.app/agency/report");
  });
  it("uses immutable asset names so one edit cannot overwrite a printed QR", async () => {
    const input = { link: { mode: "custom" as const, url: "https://example.com" }, agencyId: "a", documentId: "r" };
    const first = await createDocumentLinkDraft(input);
    const second = await createDocumentLinkDraft(input);
    expect(first.qr_code_url).not.toBe(second.qr_code_url);
    expect(mocks.upload.mock.calls[0][2].upsert).toBe(false);
  });
  it("fails before document persistence if storage fails", async () => {
    mocks.upload.mockResolvedValue({ error: { message: "Storage unavailable" } });
    await expect(createDocumentLinkDraft({ link: { mode: "custom", url: "https://example.com" }, agencyId: "a", documentId: "r" })).rejects.toThrow("Storage unavailable");
  });
});

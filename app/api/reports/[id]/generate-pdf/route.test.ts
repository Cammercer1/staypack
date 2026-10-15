import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requireReportAccess } from "@/lib/auth/requireUser";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderPdfFromUrl } from "@/lib/browserless/pdf";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";

vi.mock("@/lib/auth/requireUser", () => ({ requireReportAccess: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/env", () => ({
  getPrintRenderBaseUrl: () => "https://example.test",
}));
vi.mock("@/lib/reports/printAccessToken", () => ({
  buildPreviewPrintUrl: () => "https://example.test/private-print",
}));
vi.mock("@/lib/browserless/pdf", () => ({
  renderPdfFromUrl: vi.fn(),
  buildPdfImagePath: vi.fn(),
  buildPdfStylesheetPath: vi.fn(),
}));
afterEach(() => vi.clearAllMocks());
function setup(stale = false) {
  const { agency, report } = createLintRegressionFixtures();
  const query = {
    update: vi.fn(() => query),
    eq: vi.fn(() => query),
    select: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({
      data: stale ? null : report,
      error: null,
    })),
  };
  const storage = {
    upload: vi
      .fn<
        (
          path: string,
          body: Buffer,
          options: unknown,
        ) => Promise<{ error: null }>
      >()
      .mockResolvedValue({ error: null }),
    getPublicUrl: vi.fn((path: string) => ({
      data: { publicUrl: `https://example.test/${path}` },
    })),
    remove: vi.fn(async () => ({ error: null })),
  };
  vi.mocked(requireReportAccess).mockResolvedValue({
    report,
    agency,
    supabase: { from: () => query },
  } as unknown as Awaited<ReturnType<typeof requireReportAccess>>);
  vi.mocked(createAdminClient).mockReturnValue({
    storage: { from: () => storage },
  } as unknown as ReturnType<typeof createAdminClient>);
  vi.mocked(renderPdfFromUrl).mockResolvedValue(Buffer.from("pdf"));
  const generate = (preview = true) =>
    POST(
      new Request("https://example.test/generate-pdf", {
        method: "POST",
        body: JSON.stringify({ preview }),
      }),
      { params: Promise.resolve({ id: report.id }) },
    );
  return { report, query, storage, generate };
}
describe("PDF completion safety", () => {
  it.each(["none", "custom"] as const)("renders an unpublished saved %s link in a private PDF", async mode => {
    const { report, query, generate } = setup();
    report.status = "generated";
    report.public_slug = "reserved-only";
    report.final_report_json!.document_link_draft = {
      link: mode === "none" ? { mode } : { mode, url: "https://example.com" },
      target_url: mode === "none" ? "" : "https://example.com",
      qr_code_url: mode === "none" ? "" : "qr.png",
    };
    expect((await generate()).status).toBe(200);
    expect(renderPdfFromUrl).toHaveBeenCalledWith("https://example.test/private-print", expect.any(Object));
    const saved = (query.update.mock.calls[0] as unknown as [Partial<typeof report>])[0];
    expect(saved.final_report_json?.assets.qr_code_url).toBe(mode === "none" ? "" : "qr.png");
    expect(saved.status).toBeUndefined();
  });
  it("uses private draft rendering even when a report is already published", async () => {
    const { report, query, generate } = setup();
    report.status = "published";
    report.public_slug = "published-report";
    const original = report.final_report_json!;
    expect((await generate()).status).toBe(200);
    expect(renderPdfFromUrl).toHaveBeenCalledWith("https://example.test/private-print", expect.any(Object));
    const saved = (query.update.mock.calls[0] as unknown as [Partial<typeof report>])[0];
    expect(saved.final_report_json?.published_report_json).toEqual(original);
  });
  it("refreshes a public PDF without replacing newer draft content or its private PDF", async () => {
    const { report, query, generate } = setup();
    report.status = "published";
    report.public_slug = "published-report";
    report.pdf_url = "private-draft.pdf";
    const original = report.final_report_json!;
    report.final_report_json = {
      ...original,
      copy: { ...original.copy, heading: "Private wording" },
      assets: { ...original.assets, pdf_url: "private-draft.pdf" },
      published_report_json: original,
      document_link_draft: { link: { mode: "none" }, target_url: "", qr_code_url: "" },
    };
    expect((await generate(false)).status).toBe(200);
    expect(renderPdfFromUrl).toHaveBeenCalledWith(expect.stringContaining("/published-report/print"), expect.any(Object));
    const saved = (query.update.mock.calls[0] as unknown as [Partial<typeof report>])[0];
    expect(saved.pdf_url).toBe("private-draft.pdf");
    expect(saved.final_report_json?.assets.pdf_url).toBe("private-draft.pdf");
    expect(saved.final_report_json?.copy.heading).toBe("Private wording");
    expect(saved.final_report_json?.published_report_json?.copy).toEqual(original.copy);
    expect(saved.final_report_json?.published_report_json?.assets.pdf_url).toMatch(/report-[\da-f-]+\.pdf/);
    expect(saved.final_report_json?.published_report_json?.document_link_draft).toBeUndefined();
    expect(saved.final_report_json?.document_link_draft).toEqual(report.final_report_json.document_link_draft);
  });
  it("requires actual publication before a public PDF, even if a link reserved a slug", async () => {
    const { report, generate } = setup();
    report.status = "generated";
    report.public_slug = "reserved-only";
    expect((await generate(false)).status).toBe(400);
    expect(renderPdfFromUrl).not.toHaveBeenCalled();
  });
  it("writes an immutable PDF path and only updates the version it rendered", async () => {
    const { report, query, storage, generate } = setup();
    expect((await generate()).status).toBe(200);
    expect(storage.upload.mock.calls[0][0]).toMatch(/\/report-[\da-f-]+\.pdf$/);
    expect(query.eq).toHaveBeenCalledWith("updated_at", report.updated_at);
    expect(renderPdfFromUrl).toHaveBeenCalledWith(
      "https://example.test/private-print",
      expect.any(Object),
    );
  });
  it("does not overwrite a newer report and removes a stale rendered file", async () => {
    const { storage, generate } = setup(true);
    const response = await generate();
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain("report changed");
    expect(storage.remove).toHaveBeenCalledWith([
      storage.upload.mock.calls[0][0],
    ]);
  });
  it("rejects ungenerated reports without rendering", async () => {
    const { report, generate } = setup();
    report.final_report_json = null;
    expect((await generate()).status).toBe(400);
    expect(renderPdfFromUrl).not.toHaveBeenCalled();
  });
});

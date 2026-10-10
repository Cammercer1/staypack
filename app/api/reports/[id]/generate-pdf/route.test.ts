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
  const generate = () =>
    POST(
      new Request("https://example.test/generate-pdf", {
        method: "POST",
        body: JSON.stringify({ preview: true }),
      }),
      { params: Promise.resolve({ id: report.id }) },
    );
  return { report, query, storage, generate };
}
describe("PDF completion safety", () => {
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
  it("rejects ungenerated reports and pending link changes without rendering", async () => {
    const { report, generate } = setup();
    report.final_report_json = null;
    expect((await generate()).status).toBe(400);
    expect(renderPdfFromUrl).not.toHaveBeenCalled();
  });
});

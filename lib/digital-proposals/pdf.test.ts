import { beforeEach, describe, expect, it, vi } from "vitest";
import { BRAND_DEFAULTS } from "./brand";
import { createProposalFixture } from "./fixtures";
import { DEFAULT_PROPOSAL_DRAFT } from "./template";
import { prepareProposalPdf } from "./pdf";

const mocks = vi.hoisted(() => ({ from: vi.fn(), upload: vi.fn(), render: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mocks.from, storage: { from: () => ({ upload: mocks.upload }) } }) }));
vi.mock("@/lib/browserless/client", async importOriginal => ({ ...await importOriginal<typeof import("@/lib/browserless/client")>(), hasBrowserlessConfig: () => true, browserlessRequest: mocks.render }));
vi.mock("@/lib/browserless/pdf", () => ({ renderPdfFromUrl: vi.fn(), buildPdfImagePath: vi.fn(), buildPdfStylesheetPath: vi.fn() }));
vi.mock("./server", () => ({ ProposalError: class extends Error {} }));

function query(result: unknown) {
  const chain = { select: vi.fn(), eq: vi.fn(), is: vi.fn(), update: vi.fn(), or: vi.fn(), maybeSingle: vi.fn().mockResolvedValue(result), then: (resolve: (value: unknown) => void) => resolve(result) };
  for (const method of [chain.select, chain.eq, chain.is, chain.update, chain.or]) method.mockReturnValue(chain);
  return chain;
}
function versionQuery(status = "pending") {
  return query({ error: null, data: { id: "version", pdf_status: status, pdf_path: null, final_report_json: { version: 1, data: createProposalFixture(), draft: DEFAULT_PROPOSAL_DRAFT, brand: BRAND_DEFAULTS, attachments: [] } } });
}
beforeEach(() => { vi.clearAllMocks(); mocks.upload.mockResolvedValue({ error: null }); });

describe("proposal PDF preparation", () => {
  it("waits for the configured fonts before storing a standalone PDF", async () => {
    const save = query({ error: null });
    mocks.from.mockReturnValueOnce(versionQuery()).mockReturnValueOnce(query({ error: null, data: { id: "version" } })).mockReturnValue(save);
    mocks.render.mockResolvedValue(Buffer.from("%PDF-1.4\nfixture"));
    expect(await prepareProposalPdf("agency", "report", "version", "http://localhost:3000")).toBe("ready");
    const payload = mocks.render.mock.calls[0][1];
    expect(payload.html).toContain("family=Fraunces");
    expect(payload.html).toContain("family=DM+Sans");
    // Exercise the wait function: images alone cannot release the renderer before fonts settle.
    const ready = new Function("document", `return (${payload.waitForFunction.fn})();`);
    let finishFonts!: () => void;
    const fonts = new Promise<void>(resolve => { finishFonts = resolve; });
    let complete = false;
    const waiting = ready({ fonts: { ready: fonts }, images: [{ complete: true }] }).then(() => { complete = true; });
    await Promise.resolve();
    expect(complete).toBe(false);
    finishFonts(); await waiting;
    expect(complete).toBe(true);
    expect(save.update).toHaveBeenCalledWith({ pdf_status: "ready", pdf_path: "agency/report/version.pdf" });
  });
  it("returns an existing ready PDF without rendering again", async () => {
    mocks.from.mockReturnValueOnce(versionQuery("ready"));
    expect(await prepareProposalPdf("agency", "report", "version")).toBe("ready");
    expect(mocks.render).not.toHaveBeenCalled();
  });
  it("lets a concurrent render finish while allowing an abandoned generating claim to be retried", async () => {
    const claim = query({ error: null, data: null });
    mocks.from.mockReturnValueOnce(versionQuery("generating")).mockReturnValueOnce(claim);
    expect(await prepareProposalPdf("agency", "report", "version")).toBe("generating");
    expect(claim.or).toHaveBeenCalledWith(expect.stringContaining("pdf_status.eq.generating,pdf_started_at.lt."));
    expect(mocks.render).not.toHaveBeenCalled();
  });
});

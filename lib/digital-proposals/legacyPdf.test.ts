import { renderToStaticMarkup } from "react-dom/server";
import { load } from "cheerio";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ProposalPrintPage from "@/app/(public)/proposal/print/[versionId]/page";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { defaultAssignment } from "./assignment";
import { BRAND_DEFAULTS } from "./brand";
import { proposalFromAppraisalReport } from "./data";
import { buildProposalPdfReport, withPdfAgents } from "./pdfReport";
import { prepareProposalPdf } from "./pdf";
import type { ProposalSnapshot } from "./workspace";

const mocks = vi.hoisted(() => ({ from: vi.fn(), upload: vi.fn(), render: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("Print version not found"); } }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: mocks.from, storage: { from: () => ({ upload: mocks.upload }) } }) }));
vi.mock("@/lib/browserless/client", () => ({ hasBrowserlessConfig: () => true, browserlessRequest: mocks.render }));
vi.mock("./server", () => ({ ProposalError: class extends Error {} }));
vi.mock("./printOrigin", () => ({ proposalPrintOrigin: () => "https://staypack.test" }));
vi.mock("./printAccess", () => ({
  proposalPrintUrl: (id: string, base: string) => `${base}/proposal/print/${id}?token=fixture`,
  verifyProposalPrintToken: (_id: string, token: string) => token === "fixture",
}));

const versionId = "10000000-0000-4000-8000-000000000001";
const portraitUrl = "https://example.test/expired-agent.jpg";

function query(data: unknown) {
  const result = { data, error: null };
  const chain = { select: vi.fn(), eq: vi.fn(), neq: vi.fn(), is: vi.fn(), update: vi.fn(), or: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result), then: (resolve: (value: typeof result) => void) => resolve(result) };
  for (const method of [chain.select, chain.eq, chain.neq, chain.is, chain.update, chain.or]) method.mockReturnValue(chain);
  return chain;
}

function snapshot(kind: "lease" | "sales", revised = true): ProposalSnapshot {
  const f = createLintRegressionFixtures();
  const source = structuredClone(f[kind].final_report_json!);
  source.property.car_spaces = null;
  const data = proposalFromAppraisalReport(source, kind, "Cameron Mercer");
  const pdfReport = withPdfAgents(buildProposalPdfReport(source, data.recipient?.displayName)!, [
    { name: "Cameron Mercer", role: "Agent", email: "agent@example.test", phone: "0412345678", photoUrl: portraitUrl },
  ]);
  if (!revised) delete pdfReport.proposal_print_revision;
  return { version: 1, data, pdfReport, draft: defaultAssignment(f.agency, kind).defaults, brand: BRAND_DEFAULTS, attachments: [] };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.upload.mockResolvedValue({ error: null });
  mocks.render.mockResolvedValue(Buffer.from("%PDF-1.4\nfixture"));
});
afterEach(() => vi.unstubAllGlobals());

async function prepare(saved: ProposalSnapshot, status = "pending") {
  mocks.from.mockImplementation((table: string) => {
    if (table === "digital_proposal_versions") return query({ id: versionId, agency_id: "agency", report_id: "report", final_report_json: saved, pdf_status: status, pdf_path: null });
    if (table === "reports") return query({ listing_id: "listing" });
    if (table === "listings") return query({ id: "listing" });
    throw new Error(`Unexpected table ${table}`);
  });
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === `/proposal/print/${versionId}`) {
      const page = await ProposalPrintPage({ params: Promise.resolve({ versionId }), searchParams: Promise.resolve({ token: url.searchParams.get("token") ?? undefined }) });
      return new Response(`<html><body>${renderToStaticMarkup(page)}</body></html>`);
    }
    // Every image/font request is deliberately unavailable; no provider is contacted.
    return new Response("Unavailable fixture asset", { status: 404 });
  }));
  expect(await prepareProposalPdf("agency", "report", versionId)).toBe("ready");
}

it.each(["lease", "sales"] as const)("renders the actual %s PDF print route with its type, recipient and failed-portrait fallback", async kind => {
  const saved = snapshot(kind), before = structuredClone(saved);
  await prepare(saved);
  const body = mocks.render.mock.calls[0][1] as { html: string; waitForFunction: { fn: string } };
  const $ = load(body.html);
  expect($(".report-page")).toHaveLength(2);
  expect($("[data-proposal-appraisal-title]").toArray().map(node => $(node).text())).toEqual(Array(2).fill(kind === "lease" ? "Lease appraisal" : "Sales appraisal"));
  expect($("[data-report-recipient]").text()).toBe("Prepared for Cameron Mercer");
  expect($("[data-report-agent-portrait]")).toHaveLength(2);
  expect($("[data-report-agent-portrait]").toArray().map(node => $(node).text())).toEqual(["CM", "CM"]);
  expect($("[data-report-agent-image]")).toHaveLength(2);
  expect($("body").text()).toContain("agent@example.test");
  expect($("body").text()).toContain(kind === "lease" ? "Estimated weekly rent" : "Estimated sale price");
  const failed = { complete: true, naturalWidth: 0, hasAttribute: () => true, remove: vi.fn() };
  const loaded = { complete: true, naturalWidth: 100, hasAttribute: () => true, remove: vi.fn() };
  const legacy = { complete: true, naturalWidth: 0, hasAttribute: () => false, remove: vi.fn() };
  const ready = new Function("document", `return (${body.waitForFunction.fn})();`);
  expect(ready({ images: [failed, loaded, legacy] })).toBe(true);
  expect(failed.remove).toHaveBeenCalledOnce();
  expect(loaded.remove).not.toHaveBeenCalled();
  expect(legacy.remove).not.toHaveBeenCalled();
  expect(mocks.upload).toHaveBeenCalledWith(`agency/report/${versionId}.pdf`, expect.any(Buffer), { contentType: "application/pdf", upsert: true });
  expect(saved).toEqual(before);
});

it.each(["lease", "sales"] as const)("keeps an older %s snapshot's legacy rendering when preparing its PDF", async kind => {
  const saved = snapshot(kind, false), before = structuredClone(saved);
  await prepare(saved);
  const body = mocks.render.mock.calls[0][1] as { html: string; waitForFunction: { fn: string } };
  const $ = load(body.html);
  expect($(".report-page")).toHaveLength(2);
  expect($("[data-proposal-appraisal-title], [data-report-agent-portrait], [data-report-agent-image]")).toHaveLength(0);
  expect($(`img[src="${portraitUrl}"]`)).toHaveLength(2);
  expect($("[data-report-recipient]").text()).toBe("Prepared for Cameron Mercer");
  expect(body.waitForFunction.fn).toBe("() => Array.from(document.images).every(image => image.complete)");
  expect(saved).toEqual(before);
});

it("does not fetch, render or overwrite an existing ready PDF", async () => {
  await prepare(snapshot("lease", false), "ready");
  expect(fetch).not.toHaveBeenCalled();
  expect(mocks.render).not.toHaveBeenCalled();
  expect(mocks.upload).not.toHaveBeenCalled();
});

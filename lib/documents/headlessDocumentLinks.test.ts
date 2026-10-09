import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), estimate: vi.fn(), copy: vi.fn(), brochureCopy: vi.fn(), pdf: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/airbtics/client", () => ({ fetchAirbticsEstimate: mocks.estimate }));
vi.mock("@/lib/airbtics/positionEstimate", () => ({ positionStrEstimate: async ({ estimate }: { estimate: unknown }) => ({ estimate, positioning: null }) }));
vi.mock("@/lib/geocoding", () => ({ geocodeReportAddress: async () => ({ latitude: -33.8, longitude: 151.2 }) }));
vi.mock("@/lib/openai/generateReportCopy", () => ({ generateReportCopy: mocks.copy }));
vi.mock("@/lib/openai/generateLeaseAppraisalCopy", () => ({ generateLeaseAppraisalCopy: async () => undefined }));
vi.mock("@/lib/openai/generateSalesBrochureCopy", () => ({ generateSalesBrochureCopy: mocks.brochureCopy }));
vi.mock("@/lib/browserless/pdf", () => ({ renderPdfFromUrl: mocks.pdf, buildPdfImagePath: vi.fn(), buildPdfStylesheetPath: vi.fn() }));
import { generateHeadlessStrReport } from "@/lib/delivery/str/generateHeadlessStr";
import { generateHeadlessLeaseAppraisal } from "@/lib/delivery/lease/generateHeadlessLeaseAppraisal";
import { generateHeadlessSalesBrochure } from "@/lib/delivery/brochure/generateHeadlessSalesBrochure";
import { createEmptyReportDraft } from "@/lib/reports/emptyReportDraft";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { getMockSalesBrochureCopy } from "@/lib/collateral/buildSalesBrochureDocument";
import type { DeliveryTenant } from "@/lib/delivery/types";
import type { DocumentLink } from "./documentLink";

const fixture = createLintRegressionFixtures();
const tenant = { id: "tenant", slug: "mock", name: "Mock", agency_id: fixture.agency.id, brand: {}, feature_flags: {} } as DeliveryTenant;
let rows: Record<string, Record<string, unknown>>;
let writes: { table: string; body: Record<string, unknown> }[];
let uploads: string[];

beforeEach(() => {
  vi.clearAllMocks();
  rows = { listings: { ...fixture.listing }, reports: { ...createEmptyReportDraft({ id: "headless-report" }) }, collateral_items: { ...fixture.collateral, id: "headless-collateral", document_json: null } };
  writes = [];
  uploads = [];
  mocks.pdf.mockResolvedValue(Buffer.from("mock-pdf"));
  mocks.estimate.mockResolvedValue({ tier: "full", reportId: "mock-estimate", costCents: 0, enrichment: null, estimate: { annualRevenue: 90000, monthlyRevenue: 7500, weeklyRevenue: 1730, nightlyRate: 300, occupancyRate: 0.7, bookedNights: 255, radiusM: 2000, raw: {} } });
  mocks.copy.mockResolvedValue({ sales_pack_heading: "Mock heading", sales_pack_blurb: "Mock report description", key_metrics_line: "Estimate only", property_appeal_points: [], performance_supporting_factors: [], buyer_checks: [], methodology_note: "", disclaimer: "Estimate only", confidence_notes: "" });
  mocks.brochureCopy.mockResolvedValue(getMockSalesBrochureCopy(fixture.listing, fixture.agency));
  mocks.admin.mockReturnValue({
    from: (table: string) => {
      let body: Record<string, unknown> | null = null;
      const finish = async () => {
        if (body) { writes.push({ table, body }); rows[table] = { ...rows[table], ...body }; }
        return { data: rows[table], error: null };
      };
      const query = {
        insert: (value: Record<string, unknown>) => { body = value; return query; },
        update: (value: Record<string, unknown>) => { body = value; return query; },
        select: () => query, eq: () => query,
        single: finish, maybeSingle: finish,
        then: (resolve: (result: Awaited<ReturnType<typeof finish>>) => unknown) => finish().then(resolve),
      };
      return query;
    },
    storage: { from: (bucket: string) => ({
      upload: async (path: string) => { uploads.push(`${bucket}/${path}`); return { error: null }; },
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://assets.example/${bucket}/${path}` } }),
    }) },
  });
});

describe("headless report and brochure publication", () => {
  for (const [name, generate] of [["str", generateHeadlessStrReport], ["lease", generateHeadlessLeaseAppraisal], ["brochure", generateHeadlessSalesBrochure]] as const) {
    for (const link of [undefined, { mode: "none" }, { mode: "custom", url: `https://example.test/${name}` }] as (DocumentLink | undefined)[]) {
      it(`${name}: ${link?.mode ?? "default"} survives generation, publication, and PDF persistence`, async () => {
        const result = await generate({ tenant, agency: fixture.agency, listing: fixture.listing, listingUrl: "https://example.test/property", parsed: { ...fixture.listing.scraped_listing_json!, address: fixture.listing.property_address!, rentalAppraisal: { weeklyMin: 600, weeklyMax: 700, weeklyMidpoint: 650, compCount: 0 } }, templateIdOverride: name === "lease" ? "classic-lease-appraisal" : name === "str" ? "classic-detailed" : "sales-brochure-classic-2pg", agencyAgents: [fixture.agent], agentProfile: fixture.agent, documentLink: link });
        expect(result.pdfBuffer.toString()).toBe("mock-pdf");
        expect(result.publicUrl).toBeTruthy();
        const document = (name === "brochure" ? rows.collateral_items.document_json : rows.reports.final_report_json) as { document_link: DocumentLink; assets: { qr_code_url: string } };
        expect(document.document_link).toEqual(link ?? { mode: "none" });
        expect(Boolean(document.assets.qr_code_url)).toBe(link?.mode === "custom");
        expect(uploads.filter((path) => path.startsWith("report-assets/"))).toHaveLength(link?.mode === "custom" ? 1 : 0);
        expect(writes.filter((write) => write.table === "listings").every((write) => !["public_url", "landing_published_at", "landing_qr_code_url"].some((field) => field in write.body))).toBe(true);
        expect(mocks.pdf).toHaveBeenCalledOnce();
      });
    }
  }
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requireCollateralAccess } from "@/lib/auth/requireUser";
import { generateSalesBrochureCopy } from "@/lib/openai/generateSalesBrochureCopy";
import { generateRentalBrochureCopy } from "@/lib/openai/generateRentalBrochureCopy";
import { provisionCollateralQr } from "@/lib/collateral/provisionCollateralQr";
import { loadAgencyAgentProfiles, loadListingAgentProfile } from "@/lib/reports/loadReportAgent";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { getTemplatesForProduct } from "@/lib/templates/catalog";
import type { CollateralItem } from "@/lib/types";

vi.mock("@/lib/auth/requireUser", () => ({ requireCollateralAccess: vi.fn() }));
vi.mock("@/lib/templates/grants/assertTemplateGranted", () => ({ assertTemplateGranted: vi.fn() }));
vi.mock("@/lib/collateral/provisionCollateralQr", () => ({ provisionCollateralQr: vi.fn() }));
vi.mock("@/lib/reports/loadReportAgent", () => ({ loadAgencyAgentProfiles: vi.fn(), loadListingAgentProfile: vi.fn() }));
vi.mock("@/lib/openai/generateSalesBrochureCopy", () => ({
  generateSalesBrochureCopy: vi.fn(), SalesBrochureCopyValidationError: class extends Error {}, SalesBrochureCopyOpenAIError: class extends Error {},
}));
vi.mock("@/lib/openai/generateRentalBrochureCopy", () => ({
  generateRentalBrochureCopy: vi.fn(), RentalBrochureCopyValidationError: class extends Error {}, RentalBrochureCopyOpenAIError: class extends Error {},
}));
afterEach(() => vi.clearAllMocks());

for (const type of ["sales_brochure", "rental_brochure"] as const) {
  function setup(savedPrice?: string, advertisedPrice?: string) {
    const { listing, agency, agent, document, collateral } = createLintRegressionFixtures();
    listing.advertised_sale_price = type === "sales_brochure" ? advertisedPrice ?? null : null;
    listing.advertised_weekly_rent = type === "rental_brochure" ? advertisedPrice ?? null : null;
    const templateId = getTemplatesForProduct(type)[0].id;
    let item: CollateralItem = {
      ...collateral, type, template_id: templateId,
      document_json: savedPrice === undefined ? null : {
        ...document,
        ...(type === "rental_brochure"
          ? { type, version: "rental_brochure_v1" as const }
          : { type, version: "sales_brochure_v1" as const }),
        template_id: templateId, copy: { ...document.copy, price_value: savedPrice },
      },
    };
    const query = {
      update: vi.fn((data: Partial<CollateralItem>) => { item = { ...item, ...data }; return query; }),
      eq: vi.fn(() => query), select: vi.fn(() => query), single: vi.fn(async () => ({ data: item, error: null })),
    };
    vi.mocked(requireCollateralAccess).mockImplementation(async () => ({
      collateral: item, agency, listing, supabase: { from: () => query },
    }) as unknown as Awaited<ReturnType<typeof requireCollateralAccess>>);
    vi.mocked(generateSalesBrochureCopy).mockResolvedValue(document.copy);
    vi.mocked(generateRentalBrochureCopy).mockResolvedValue(document.copy);
    vi.mocked(loadListingAgentProfile).mockResolvedValue(agent);
    vi.mocked(loadAgencyAgentProfiles).mockResolvedValue([agent]);
    vi.mocked(provisionCollateralQr).mockResolvedValue({ provisionedListing: listing, qrCodeUrl: "", qrTargetUrl: "" });
    const generate = (body?: unknown) => POST(new Request("https://example.test/generate-copy", {
      method: "POST", ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }), { params: Promise.resolve({ id: item.id }) });
    return { generate, query, getItem: () => item };
  }

  describe(`${type} price during generation`, () => {
    it("rejects a missing price before calling a generator or writing a document", async () => {
      const { generate, query } = setup();
      const response = await generate();
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("brochure_price_required");
      expect(generateSalesBrochureCopy).not.toHaveBeenCalled();
      expect(generateRentalBrochureCopy).not.toHaveBeenCalled();
      expect(query.update).not.toHaveBeenCalled();
    });
    it("stores the chosen price and keeps it when rewriting the brochure", async () => {
      const { generate, getItem } = setup();
      const chosen = type === "rental_brochure" ? "950" : "1250000";
      expect((await generate({ price_value: chosen })).status).toBe(200);
      expect((await generate()).status).toBe(200);
      expect(getItem().document_json).toMatchObject({ copy: { price_value: type === "rental_brochure" ? "$950 per week" : "$1,250,000" } });
    });
    it("uses an existing advertised price for older clients and supports Contact agent", async () => {
      const { generate, getItem } = setup(undefined, type === "rental_brochure" ? "$875" : "$1,200,000");
      expect((await generate()).status).toBe(200);
      expect(getItem().document_json).toMatchObject({ copy: { price_value: type === "rental_brochure" ? "$875 per week" : "$1,200,000" } });
      expect((await generate({ price_value: "Contact agent" })).status).toBe(200);
      expect(getItem().document_json).toMatchObject({ copy: { price_value: "Contact Agent" } });
    });
    it("does not silently replace a deliberately cleared input with an old price", async () => {
      const { generate, query } = setup("Contact agent");
      expect((await generate({ price_value: "  " })).status).toBe(400);
      expect(query.update).not.toHaveBeenCalled();
    });
  });
}

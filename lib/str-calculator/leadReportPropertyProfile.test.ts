import { afterEach, expect, it, vi } from "vitest";
import type { Agency } from "@/lib/types";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
import { refreshPropertyProfile } from "@/lib/domain-avm/refreshPropertyProfile";
import { lookupDomainProperty, searchDomainProperties } from "@/lib/domain-avm/propertyLookup";
import { fetchUsPropertyData } from "@/lib/us-property/client";
import usProperty from "@/lib/us-property/fixtures/west-hollywood.json";
import { calculatorLeadReportDraft, type CalculatorReportLead } from "./leadReport";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/templates/resolveAvailableTemplates", () => ({ resolveAvailableTemplates: vi.fn() }));
vi.mock("@/lib/domain-avm/propertyLookup", () => ({ lookupDomainProperty: vi.fn(), searchDomainProperties: vi.fn() }));
vi.mock("@/lib/us-property/client", () => ({ fetchUsPropertyData: vi.fn() }));
afterEach(() => { vi.resetAllMocks(); vi.unstubAllGlobals(); });

const lead = (address: string, country: "AU" | "US"): CalculatorReportLead => ({ id: "lead-a", agency_id: "agency-a", report_id: null,
  address, bedrooms: 3, country, status: "failed", input_json: { bathrooms: 1.5 }, original_estimate_json: null, completed_at: null });

it("carries AU locality into the Domain search while keeping the unit/range and manual bed/bath inputs", async () => {
  const network = vi.fn(); vi.stubGlobal("fetch", network);
  const draft = calculatorLeadReportDraft(lead("14A/18-24 Aubrey Street, Surfers Paradise QLD 4217, Australia", "AU"), { id: "agency-a", country_code: "AU" } as Agency);
  const listing = createEmptyListingDraft(draft.property);
  expect(network).not.toHaveBeenCalled();
  expect(searchDomainProperties).not.toHaveBeenCalled();
  expect(fetchUsPropertyData).not.toHaveBeenCalled();
  vi.mocked(searchDomainProperties).mockResolvedValue([{ source: "domain", slug: "14a-18-24-aubrey-street", streetAddress: "14A/18-24 Aubrey Street",
    address: "14A/18-24 Aubrey Street, Surfers Paradise QLD 4217", suburb: "Surfers Paradise", state: "QLD", postcode: "4217" }]);
  vi.mocked(lookupDomainProperty).mockResolvedValue({ ...listing, bedrooms: 4, bathrooms: 2, scraped_listing_json: { images: [], agents: [], warnings: [], confidence: "high",
    propertyLookup: { source: "domain", matchedAt: "2026-10-15T00:00:00Z", features: ["Pool"], media: [] } } });
  const before = structuredClone(listing);
  const result = await refreshPropertyProfile(listing);
  expect(searchDomainProperties).toHaveBeenCalledExactlyOnceWith("14A/18-24 Aubrey Street Surfers Paradise QLD 4217");
  expect(result.propertyLookup.features).toEqual(["Pool"]);
  expect(listing).toEqual(before);
  expect(listing).toMatchObject({ bedrooms: 3, bathrooms: 1.5 });
  expect(network).not.toHaveBeenCalled();
});

it("converts a US comma-separated apartment into a clean Zillow query that passes street/state/ZIP matching", async () => {
  const network = vi.fn(); vi.stubGlobal("fetch", network);
  const draft = calculatorLeadReportDraft(lead("616 N Croft Ave, Apt 2, West Hollywood, CA 90048-1234, USA", "US"), { id: "agency-a", country_code: "US" } as Agency);
  const listing = createEmptyListingDraft(draft.property);
  expect(network).not.toHaveBeenCalled();
  expect(fetchUsPropertyData).not.toHaveBeenCalled();
  vi.mocked(fetchUsPropertyData).mockResolvedValue({ ...usProperty, bedrooms: 4, bathrooms: 2,
    address: { streetAddress: "616 N Croft Ave APT 2", city: "West Hollywood", state: "CA", zipcode: "90048" } });
  const before = structuredClone(listing);
  const result = await refreshPropertyProfile(listing);
  expect(fetchUsPropertyData).toHaveBeenCalledExactlyOnceWith("property-details-address", { address: "616 N Croft Ave Apt 2, West Hollywood, CA, 90048-1234" });
  expect(result.propertyLookup.source).toBe("zillow");
  expect(listing).toEqual(before);
  expect(listing).toMatchObject({ property_address: "616 N Croft Ave Apt 2", suburb: "West Hollywood", state: "CA", postcode: "90048-1234", bedrooms: 3, bathrooms: 1.5 });
  expect(network).not.toHaveBeenCalled();
});

import { describe, expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { appraisalListing, captureAppraisalInputs, editAppraisalEvidence } from "./workspaceInputs";
import { resolveAppraisalInput } from "./resolveAppraisalInput";
import type { WorkspaceAppraisal } from "./workspaceTypes";
const f = createLintRegressionFixtures();
const appraisal = (kind: "lease" | "sales"): WorkspaceAppraisal => ({ ...f.appraisal, kind, inputs_json: captureAppraisalInputs(f.listing), input_revision: 0, document_json: null, document_revision: null });
describe("independent customer appraisal inputs", () => {
  it.each(["lease","sales"] as const)("isolates %s figures, comp choices and the property", kind => {
    const first = appraisal(kind), second = appraisal(kind);
    const edits = kind === "lease" ? { weekly_min: 1400, weekly_max: 1600, weekly_midpoint: 1500 } : { price_min: 2800000, price_max: 3200000, price_midpoint: 3000000 };
    const changed = editAppraisalEvidence(appraisalListing(f.listing,first),kind,{ expected_updated_at: first.updated_at, ...edits, selected_comp_listing_ids: ["https://example.test/comparable/0"] });
    const result = resolveAppraisalInput(changed);
    expect(kind === "lease" ? result.rentalAppraisal?.weeklyMidpoint : result.salesAppraisal?.priceMidpoint).toBe(kind === "lease" ? 1500 : 3000000);
    expect(second.inputs_json).toEqual(captureAppraisalInputs(f.listing));
    expect(first.inputs_json).toEqual(second.inputs_json);
    expect(changed.scraped_listing_json?.[kind === "lease" ? "salesAppraisal" : "rentalAppraisal"]).toEqual(f.listing.scraped_listing_json?.[kind === "lease" ? "salesAppraisal" : "rentalAppraisal"]);
  });
  it("keeps the snapshot stable as the property changes but uses current tenancy/archive state", () => {
    const saved = appraisal("lease");
    const changed = { ...f.listing, bedrooms: 9, status: "archived" as const };
    expect(appraisalListing(changed,saved)).toMatchObject({ bedrooms: 4, status: "archived", agency_id: f.listing.agency_id });
  });
  it("rejects invalid price bands and stale property evidence", () => {
    expect(() => editAppraisalEvidence(f.listing,"lease",{ expected_updated_at: f.listing.updated_at, weekly_min: 1600, weekly_max: 1400 })).toThrow("Minimum");
    expect(() => editAppraisalEvidence({ ...f.listing, bedrooms: 8 },"sales",{ expected_updated_at: f.listing.updated_at, price_midpoint: 3000000 })).toThrow("Property details changed");
  });
});

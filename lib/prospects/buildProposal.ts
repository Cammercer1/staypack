import { buildFinalReportJson } from "@/lib/reports/buildFinalReportJson";
import { initialStrManagementScenario, applyStrEstimateAdjustments, saveStrRateOverride } from "@/lib/reports/strEstimateAdjustments";
import { readStrPropertyContext } from "@/lib/str/propertyInputs";
import { proposalFromReport } from "@/lib/digital-proposals/data";
import { resolveProposalBrand } from "@/lib/digital-proposals/brand";
import { validateProposalDraft } from "@/lib/digital-proposals/template";
import { proposalSnapshotSchema } from "@/lib/digital-proposals/workspace";
import { prospectAgency, prospectProfileSchema, prospectPropertyOverridesSchema, type ProspectProfile } from "./profile";
import { DEFAULT_DISCLAIMER, type AiCopyJson, type Listing, type Report, type StrEnrichmentJson, type StrEstimate } from "@/lib/types";

export function buildProspectProposal({ profile: input, brandId, proposalId, listing: originalListing, estimate, enrichment, propertyOverrides = {}, now = new Date().toISOString() }: {
  profile: ProspectProfile; brandId: string; proposalId: string; listing: Listing;
  estimate: StrEstimate; enrichment: StrEnrichmentJson | null; propertyOverrides?: unknown; now?: string;
}) {
  const checkedPropertyOverrides = prospectPropertyOverridesSchema.parse(propertyOverrides);
  const listing = { ...originalListing, ...checkedPropertyOverrides };
  const profile = prospectProfileSchema.parse(input);
  const agency = prospectAgency(profile, brandId);
  const scenario = initialStrManagementScenario(estimate, agency.str_management_presets);
  if (!scenario || !estimate.annualRevenue || estimate.annualRevenue <= 0) throw new Error("A valid market estimate is required before preparing a prospect proposal.");
  const finalEstimate = applyStrEstimateAdjustments(estimate, scenario.rates);
  const assumptions = "Estimates assume professional presentation, active pricing and availability across the year. Management fees and operating costs are excluded. The letting strategy and available nights must be confirmed against permitted use and owner requirements.";
  const copy: AiCopyJson = {
    sales_pack_heading: "Short-term rental potential",
    sales_pack_blurb: `Explore the estimated short-term rental potential of ${listing.property_address}, ${listing.suburb}, with ${profile.name}.`,
    key_metrics_line: "Estimated gross STR revenue before costs",
    property_appeal_points: [], performance_supporting_factors: [], buyer_checks: [],
    methodology_note: assumptions, disclaimer: `${DEFAULT_DISCLAIMER} ${assumptions}`,
    confidence_notes: "Subject to property inspection and confirmation of the letting strategy.",
  };
  const overrides = { ...saveStrRateOverride(null, scenario.rates, scenario.assumptions), property: checkedPropertyOverrides,
    strProperty: readStrPropertyContext(listing, { user_overrides_json: null }) };
  const report: Report = {
    id: proposalId, agency_id: brandId, listing_id: listing.id, created_by: null, status: "generated",
    public_slug: null, public_url: null, qr_code_url: null, pdf_url: null,
    raw_airbtics_json: null, airbtics_tier: null, airbtics_report_id: null,
    str_enrichment_json: enrichment, airbtics_cost_cents: null, airbtics_fetched_at: null,
    original_estimate_json: estimate, user_overrides_json: overrides, final_estimate_json: finalEstimate,
    ai_copy_json: copy, final_report_json: null, template_id: "minimalist-detailed", error_message: null,
    generated_at: now, published_at: null, created_at: now, updated_at: now,
  };
  const document = buildFinalReportJson({ agency, listing, report, estimate: finalEstimate, copy, resolvedAgents: [] });
  document.generated_at = now;
  const data = proposalFromReport(document);
  data.agents = structuredClone(profile.contacts);
  const draft = structuredClone(profile.assignment.defaults);
  const validation = validateProposalDraft(draft, data);
  if (!validation.draft) throw new Error(validation.errors.join(" "));
  const snapshot = proposalSnapshotSchema.parse({ version: 1, data, draft,
    brand: resolveProposalBrand({ presetId: draft.presetId, template: draft.brandOverrides }).values,
    attachments: [], assignment: { name: profile.assignment.name, version: profile.assignment.version } });
  return { snapshot, overrides, finalEstimate };
}

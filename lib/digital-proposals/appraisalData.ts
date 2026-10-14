import { assetUrlSchema } from "./assets";
import { z } from "zod";
import type { FinalReportJson } from "@/lib/types";
// Public allowlist: never include provider payloads, the unused comparable pool or customer contact details.
const figure = z.number().finite().nonnegative().nullable();
const comparable = z.object({ id: z.string(), name: z.string(), imageUrl: assetUrlSchema, bedrooms: figure, bathrooms: figure,
  price: figure, priceDisplay: z.string().nullable(), status: z.enum(["rental", "sold", "for_sale"]), soldDate: z.string().nullable(), suburb: z.string().nullable() });
const base = { minimum: figure, maximum: figure, midpoint: figure, summary: z.string(), evidenceNote: z.string(), methodology: z.string(),
  highlights: z.array(z.string()), comparables: z.array(comparable).max(6) };
export const appraisalProposalDataSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("lease"), ...base, market: z.object({ suburb: z.string(), vacancyRate: figure, medianWeeklyRent: figure, renterPercent: figure, asOf: z.string().nullable() }).nullable() }),
  z.object({ kind: z.literal("sales"), ...base }),
]);
export type AppraisalProposalData = z.infer<typeof appraisalProposalDataSchema>;
export function appraisalProposalData(report: FinalReportJson, kind: "lease" | "sales"): AppraisalProposalData {
  const copy = report.copy;
  const common = { summary: copy.blurb, evidenceNote: copy.comparable_evidence ?? "", methodology: copy.methodology_note.replace(/\bon page 2\b/gi, "in the comparable evidence"), highlights: copy.appeal_points };
  if (kind === "lease") {
    const market = report.ltr_enrichment?.suburb_market;
    return appraisalProposalDataSchema.parse({ ...common, kind, minimum: report.ltr.weekly_min, maximum: report.ltr.weekly_max, midpoint: report.ltr.weekly_midpoint,
      comparables: (report.ltr_enrichment?.comps ?? []).slice(0, 6).map(c => ({ id: c.listing_id, name: c.name, imageUrl: assetUrlSchema.safeParse(c.thumbnail_url).success ? c.thumbnail_url : "", bedrooms: c.bedrooms, bathrooms: c.bathrooms, price: c.weekly_rent, priceDisplay: null, status: "rental", soldDate: null, suburb: c.suburb })),
      market: market ? { suburb: market.suburb, vacancyRate: market.vacancy_rate_pct, medianWeeklyRent: market.median_weekly_rent, renterPercent: market.renter_pct, asOf: market.as_of } : null });
  }
  return appraisalProposalDataSchema.parse({ ...common, kind, minimum: report.sale_estimate?.price_min ?? null, maximum: report.sale_estimate?.price_max ?? null, midpoint: report.sale_estimate?.price_midpoint ?? null,
    comparables: (report.sales_enrichment?.comps ?? []).slice(0, 6).map(c => ({ id: c.listing_id, name: c.name, imageUrl: assetUrlSchema.safeParse(c.thumbnail_url).success ? c.thumbnail_url : "", bedrooms: c.bedrooms, bathrooms: c.bathrooms, price: c.price, priceDisplay: c.price_display, status: c.sale_status, soldDate: c.sold_date, suburb: c.suburb })) });
}

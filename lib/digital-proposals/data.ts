import { resolveSalesAppraisalCopyDisclaimers } from "@/lib/sales-appraisal/salesAppraisalDisclaimer";
import { appraisalProposalDataSchema, appraisalProposalData } from "./appraisalData";
import { propertyMarketSchema } from "@/lib/property-market/schema";
import { z } from "zod";
import { DEFAULT_DISCLAIMER, type FinalReportJson } from "@/lib/types";
import { seasonalProfileFromReport, seasonalProfileSchema } from "./seasonality";
import { occupancyProfileFromReport, occupancyProfileSchema, occupancyUnavailableMessage } from "./occupancy";

import { assetUrlSchema } from "./assets";
export { assetUrlSchema } from "./assets";
const figure = z.number().finite().nonnegative().nullable();
export const proposalAgentSchema = z.object({
  name: z.string(), role: z.string(), phone: z.string(), email: z.string(), photoUrl: assetUrlSchema,
});
export type ProposalAgent = z.infer<typeof proposalAgentSchema>;

/** Public allowlist. Private customer contact details never enter the template model. */
export const proposalDataSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  appraisal: appraisalProposalDataSchema.optional(),
  market: propertyMarketSchema.optional(),
  generatedAt: z.iso.datetime(),
  agency: z.object({ name: z.string(), logoUrl: assetUrlSchema, phone: z.string().optional(), email: z.string().optional(), websiteUrl: z.string().optional() }),
  agent: z.object({ name: z.string(), role: z.string() }),
  agents: z.array(proposalAgentSchema).default([]),
  recipient: z.object({ displayName: z.string() }).nullable(),
  property: z.object({
    address: z.string().min(1), suburb: z.string(), state: z.string(), postcode: z.string(),
    bedrooms: figure, bathrooms: figure, carSpaces: figure, guests: figure,
    estimatedValue: figure, heroImageUrl: assetUrlSchema,
    gallery: z.array(assetUrlSchema), amenities: z.array(z.string()),
  }),
  ltr: z.object({ weeklyRent: figure, annualRent: figure }),
  str: z.object({ market: z.object({ annualRevenue: figure }), managed: z.object({ annualRevenue: figure }) }),
  seasonality: seasonalProfileSchema.nullable().default(null),
  occupancy: occupancyProfileSchema.nullable().default(null),
  occupancyNotice: z.string().max(600).optional(),
  comparables: z.array(z.object({ name: z.string(), imageUrl: assetUrlSchema, bedrooms: figure, annualRevenue: figure, distanceM: figure })).max(6).default([]),
  disclaimer: z.string().trim().min(1),
});
export type ProposalData = z.infer<typeof proposalDataSchema>;
const validFigure = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
const safeAsset = (value: string | undefined) => assetUrlSchema.safeParse(value ?? "").success ? value ?? "" : "";

export function proposalFromReport(report: FinalReportJson, recipientDisplayName?: string | null): ProposalData {
  const scenario = report.str_scenario;
  const weeklyRent = validFigure(report.ltr.weekly_midpoint);
  return proposalDataSchema.parse({
    market: report.market,
    version: 1, generatedAt: report.generated_at,
    agency: { name: report.agency.name, logoUrl: safeAsset(report.agency.logo_dark_url) || safeAsset(report.agency.logo_url),
      phone: report.agency.phone, email: report.agency.email, websiteUrl: report.agency.website_url },
    agent: { name: report.agent.name, role: report.agent.role_title },
    recipient: recipientDisplayName?.trim() ? { displayName: recipientDisplayName.trim() } : null,
    property: {
      address: report.property.address, suburb: report.property.suburb, state: report.property.state,
      postcode: report.property.postcode, bedrooms: validFigure(report.property.bedrooms),
      bathrooms: validFigure(report.property.bathrooms), carSpaces: validFigure(report.property.car_spaces),
      guests: validFigure(report.property.accommodates), estimatedValue: validFigure(report.property.estimated_value),
      heroImageUrl: safeAsset(report.property.hero_image_url),
      gallery: report.property.selected_image_urls.map(safeAsset).filter(Boolean),
      amenities: report.property.amenities ?? [],
    },
    ltr: { weeklyRent, annualRent: validFigure(report.ltr.annual_midpoint) ?? (weeklyRent === null ? null : weeklyRent * 52) },
    str: {
      market: { annualRevenue: validFigure(scenario ? scenario.market_benchmark.annual_revenue : report.str.annual_revenue) },
      managed: { annualRevenue: scenario?.basis === "management" ? validFigure(report.str.annual_revenue) : null },
    },
    disclaimer: report.copy.disclaimer?.trim() || DEFAULT_DISCLAIMER,
    seasonality: seasonalProfileFromReport(report.str_enrichment?.seasonality),
    occupancy: occupancyProfileFromReport(report.str_enrichment?.market_occupancy),
    occupancyNotice: occupancyUnavailableMessage(report.str_enrichment?.market_occupancy),
    comparables: (report.str_enrichment?.comps ?? []).slice(0, 6).map(comp => ({
      name: comp.name, imageUrl: safeAsset(comp.thumbnail_url), bedrooms: validFigure(comp.bedrooms),
      annualRevenue: validFigure(comp.annual_revenue), distanceM: validFigure(comp.distance_m),
    })),
  });
}

// Keep authoring imports compatible; the public viewer imports presentation directly.
export { comparablesByEstimate, comparisonRows, managedScenarioLabel } from "./presentation";
export type { ComparisonMode, ScenarioId } from "./presentation";

/** Typed rental/sales projection; legacy STR projections remain byte-for-byte compatible. */
export function proposalFromAppraisalReport(report: FinalReportJson, kind: "lease" | "sales", recipient?: string | null): ProposalData {
  const source = kind === "sales" ? { ...report, copy: resolveSalesAppraisalCopyDisclaimers(report.copy) } : report;
  return proposalDataSchema.parse({ ...proposalFromReport(source, recipient), version: 2, appraisal: appraisalProposalData(source, kind) });
}

import { DEFAULT_DISCLAIMER } from "@/lib/types";
import { proposalDataSchema, type ProposalData } from "./data";

export const PROPOSAL_FIXTURES = {
  complete: "Complete appraisal", incomplete: "Missing rent & property value",
  general: "No customer assigned", marketOnly: "Market estimate only",
} as const;
export type ProposalFixtureId = keyof typeof PROPOSAL_FIXTURES;

/** Illustrative data only. This module never fetches or mutates a real appraisal. */
export function createProposalFixture(id: ProposalFixtureId = "complete"): ProposalData {
  const data: ProposalData = {
    version: 1, generatedAt: "2026-10-12T00:00:00.000Z",
    agency: { name: "Coast & Country", logoUrl: "" },
    agent: { name: "Alex Morgan", role: "Property specialist" },
    agents: [],
    recipient: { displayName: "Jordan Taylor" },
    property: {
      address: "42 Ocean Parade, Burleigh Heads", suburb: "Burleigh Heads", state: "QLD", postcode: "4220",
      bedrooms: 4, bathrooms: 2, carSpaces: 2, guests: 8, estimatedValue: 1250000,
      heroImageUrl: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=80",
      gallery: [], amenities: ["Pool", "Air conditioning", "Outdoor dining", "Parking"],
    },
    ltr: { weeklyRent: 1150, annualRent: 59800 },
    str: { market: { annualRevenue: 98500 }, managed: { annualRevenue: 113275 } },
    seasonality: { basis: "seasonal_projection", weights: [0.12, 0.08, 0.08, 0.09, 0.06, 0.06, 0.07, 0.06, 0.07, 0.08, 0.09, 0.14] },
    occupancy: { basis: "historical_market", label: "Gold Coast", allPropertyTypes: false,
      months: [78, 70, 67, 72, 60, 58, 64, 61, 66, 71, 74, 83].map((average, index) => ({ month: `2025-${String(index + 1).padStart(2, "0")}`, average })) },
    disclaimer: DEFAULT_DISCLAIMER,
    comparables: [],
  };
  if (id === "incomplete") { data.ltr = { weeklyRent: null, annualRent: null }; data.property.estimatedValue = null; }
  if (id === "general") data.recipient = null;
  if (id === "marketOnly") data.str.managed.annualRevenue = null;
  return proposalDataSchema.parse(data);
}

import type { LtrRentalCompCard } from "@/lib/types";

export const LEASE_APPRAISAL_COMPARABLE_DISCLAIMER =
  "Comparable listings are based on publicly available rental advertisements at the time of preparation. Advertised rents may differ from final leased prices. This appraisal is intended as a rental guide only and does not constitute a formal valuation or rental guarantee.";

function formatAudWeekly(amount: number) {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function propertyTypePhrase(beds: number, propertyType?: string) {
  const normalized = propertyType?.trim().toLowerCase() ?? "apartment";
  if (normalized.includes("apartment") || normalized.includes("unit")) {
    return `${beds}-bedroom apartments`;
  }
  if (normalized.includes("townhouse")) {
    return `${beds}-bedroom townhouses`;
  }
  if (normalized.includes("house") || normalized.includes("villa")) {
    return `${beds}-bedroom houses`;
  }
  return `${beds}-bedroom ${normalized} properties`;
}

function subjectFeaturePhrase(description: string, bathrooms: number, carSpaces: number) {
  const desc = description.toLowerCase();
  const features: string[] = [];

  if (/\bnorth[- ]?facing\b/.test(desc) || desc.includes("north facing")) {
    features.push("north-facing aspect");
  }
  if (/\bview|skyline|ocean\b/.test(desc)) {
    features.push("views");
  }
  if (/\b(level|floor|high)\b/.test(desc) && /\b\d{1,2}(st|nd|rd|th)?\b/.test(desc)) {
    features.push("elevated position");
  } else if (desc.includes("level") || desc.includes("floor")) {
    features.push("elevated position");
  }
  if (bathrooms >= 2) {
    features.push("two bathrooms");
  }
  if (carSpaces >= 1) {
    features.push("secure car space");
  }

  if (!features.length) {
    return "";
  }

  return features.slice(0, 4).join(", ");
}

export type DeriveComparableEvidenceInput = {
  suburb?: string;
  bedrooms?: number;
  bathrooms?: number;
  carSpaces?: number;
  propertyType?: string;
  description?: string;
  compCount: number;
  weeklyMin: number | null;
  weeklyMax: number | null;
  featuredComps?: Pick<LtrRentalCompCard, "weekly_rent">[];
};

export function deriveComparableEvidence({
  suburb = "the local area",
  bedrooms = 2,
  bathrooms = 1,
  carSpaces = 0,
  propertyType,
  description = "",
  compCount,
  weeklyMin,
  weeklyMax,
  featuredComps = [],
}: DeriveComparableEvidenceInput): string {
  const rents = featuredComps
    .map((comp) => comp.weekly_rent)
    .filter((rent): rent is number => rent != null && rent > 0);

  const compMin = rents.length > 0 ? Math.min(...rents) : weeklyMin;
  const compMax = rents.length > 0 ? Math.max(...rents) : weeklyMax;

  const compRangePhrase =
    compMin != null && compMax != null
      ? compMin === compMax
        ? `around ${formatAudWeekly(compMin)} per week`
        : `between ${formatAudWeekly(compMin)} and ${formatAudWeekly(compMax)} per week`
      : "within a similar weekly rent band";

  const typePhrase = propertyTypePhrase(bedrooms, propertyType);
  const reviewLead =
    compCount > 0
      ? `we reviewed ${compCount} similar ${typePhrase} available for lease near ${suburb}`
      : `we reviewed similar ${typePhrase} available for lease near ${suburb}`;

  const para1 = `To support the appraisal range, ${reviewLead}. The strongest comparable properties are currently advertised ${compRangePhrase}, with pricing influenced by views, building quality, parking, amenities and proximity to the beach, light rail and central ${suburb}.`;

  const features = subjectFeaturePhrase(description, bathrooms, carSpaces);
  const featuresLead = features
    ? `Given the subject property's ${features}, `
    : "Given the subject property's configuration and location, ";

  const appraisalRange =
    weeklyMin != null && weeklyMax != null
      ? weeklyMin === weeklyMax
        ? `a weekly rent of ${formatAudWeekly(weeklyMin)}`
        : `a weekly rental range of ${formatAudWeekly(weeklyMin)} to ${formatAudWeekly(weeklyMax)}`
      : "the indicated weekly rent range";

  const para2 = `${featuresLead}${appraisalRange} is considered reasonable in the current market.`;

  return `${para1}\n\n${para2}`;
}

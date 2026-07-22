import { propertyTypeFamily } from "@/lib/rental/computeRentBand";
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
  if (/\b(view|views|skyline|ocean)\b/.test(desc)) {
    features.push("views");
  }
  if (/\b(level|floor)\s+\d{1,2}\b|\btop floor\b|\bupper level\b|\bhigh-rise\b/.test(desc)) {
    features.push("elevated position");
  }
  if (bathrooms >= 2) {
    features.push("two bathrooms");
  }
  if (carSpaces >= 1) {
    const secureParking =
      /\bsecure\b.{0,30}\b(car|parking|garage|carport)\b/.test(desc) ||
      /\b(car|parking|garage|carport)\b.{0,30}\bsecure\b/.test(desc);
    features.push(secureParking ? "secure parking" : "off-street parking");
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
  featuredComps?: Pick<LtrRentalCompCard, "weekly_rent" | "property_type">[];
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
  const subjectFamily = propertyTypeFamily(propertyType);
  const exactFeaturedComps = featuredComps.filter(
    (comp) =>
      subjectFamily === "other" ||
      propertyTypeFamily(comp.property_type ?? undefined) === subjectFamily,
  );
  const rangeComps =
    exactFeaturedComps.length > 0 ? exactFeaturedComps : featuredComps;
  const rents = rangeComps
    .map((comp) => comp.weekly_rent)
    .filter((rent): rent is number => rent != null && rent > 0);
  const fallbackUnitCount = featuredComps.filter(
    (comp) =>
      subjectFamily === "townhouse" &&
      propertyTypeFamily(comp.property_type ?? undefined) === "unit",
  ).length;

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

  const fallbackContext =
    fallbackUnitCount > 0
      ? ` ${fallbackUnitCount} upper-band ${fallbackUnitCount === 1 ? "unit listing is" : "unit listings are"} shown as secondary context only and were not used to set the townhouse rent range.`
      : "";

  const para1 = `To support the appraisal range, ${reviewLead}.${fallbackContext} The strongest exact-type comparable properties are currently advertised ${compRangePhrase}, with pricing influenced by condition, layout, parking, local amenities and transport access.`;

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

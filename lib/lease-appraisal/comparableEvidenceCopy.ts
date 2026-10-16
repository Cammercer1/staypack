import { propertyTypeFamily } from "@/lib/rental/computeRentBand";
import { appraisalSubjectFeatures } from "@/lib/copy/appraisalSubjectFeatures";
import { rentalGuideComparison } from "@/lib/copy/appraisalGuideCopy";
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

  const features = appraisalSubjectFeatures(description, bathrooms, carSpaces);

  const appraisalRange =
    weeklyMin != null && weeklyMax != null
      ? weeklyMin === weeklyMax
        ? `a weekly rent of ${formatAudWeekly(weeklyMin)}`
        : `a weekly rental range of ${formatAudWeekly(weeklyMin)} to ${formatAudWeekly(weeklyMax)}`
      : "the indicated weekly rent range";

  const outsideSelected = rentalGuideComparison(weeklyMin, weeklyMax, rents);
  const comparison = outsideSelected
    ? `The guide is ${outsideSelected} the selected advertised rents; review the differences between the properties before relying on it.`
    : "Selected advertised rents provide context and do not establish an achieved rent for this property.";
  const para2 = `The appraisal indicates ${appraisalRange}. ${comparison} Review the subject property's ${features ? `${features}, ` : ""}condition, inclusions and location when setting the rent.`;

  return `${para1}\n\n${para2}`;
}

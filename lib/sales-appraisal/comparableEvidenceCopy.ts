import type { SaleCompCard } from "@/lib/types";

export const SALES_APPRAISAL_COMPARABLE_DISCLAIMER =
  "Comparable evidence is based on publicly available sold results and current advertisements at the time of preparation. Price guides for active listings may differ from final sale prices. This appraisal is intended as a market guide only and does not constitute a formal valuation or price guarantee.";

function formatAud(amount: number) {
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

export type DeriveSaleComparableEvidenceInput = {
  suburb?: string;
  bedrooms?: number;
  bathrooms?: number;
  carSpaces?: number;
  propertyType?: string;
  description?: string;
  soldCompCount: number;
  forSaleCompCount: number;
  priceMin: number | null;
  priceMax: number | null;
  featuredComps?: Pick<SaleCompCard, "price" | "sale_status">[];
};

export function deriveSaleComparableEvidence({
  suburb = "the local area",
  bedrooms = 2,
  bathrooms = 1,
  carSpaces = 0,
  propertyType,
  description = "",
  soldCompCount,
  forSaleCompCount,
  priceMin,
  priceMax,
  featuredComps = [],
}: DeriveSaleComparableEvidenceInput): string {
  const soldPrices = featuredComps
    .filter((comp) => comp.sale_status === "sold")
    .map((comp) => comp.price)
    .filter((price): price is number => price != null && price > 0);

  const compMin = soldPrices.length > 0 ? Math.min(...soldPrices) : priceMin;
  const compMax = soldPrices.length > 0 ? Math.max(...soldPrices) : priceMax;

  const compRangePhrase =
    compMin != null && compMax != null
      ? compMin === compMax
        ? `around ${formatAud(compMin)}`
        : `between ${formatAud(compMin)} and ${formatAud(compMax)}`
      : "within a similar price band";

  const typePhrase = propertyTypePhrase(bedrooms, propertyType);
  const reviewLead =
    soldCompCount > 0
      ? `we reviewed ${soldCompCount} recently sold ${typePhrase} near ${suburb}${forSaleCompCount > 0 ? `, alongside ${forSaleCompCount} currently on the market` : ""}`
      : `we reviewed similar ${typePhrase} recently sold and for sale near ${suburb}`;

  const para1 = `To support the appraisal range, ${reviewLead}. The strongest comparable results transacted ${compRangePhrase}, with pricing influenced by views, building quality, parking, amenities and proximity to local lifestyle drawcards in ${suburb}.`;

  const features = subjectFeaturePhrase(description, bathrooms, carSpaces);
  const featuresLead = features
    ? `Given the subject property's ${features}, `
    : "Given the subject property's configuration and location, ";

  const appraisalRange =
    priceMin != null && priceMax != null
      ? priceMin === priceMax
        ? `a sale price of ${formatAud(priceMin)}`
        : `an estimated sale price range of ${formatAud(priceMin)} to ${formatAud(priceMax)}`
      : "the indicated price range";

  const para2 = `${featuresLead}${appraisalRange} is considered reasonable in the current market.`;

  return `${para1}\n\n${para2}`;
}

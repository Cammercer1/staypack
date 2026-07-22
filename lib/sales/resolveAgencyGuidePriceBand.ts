import { extractPropertyPriceAmounts } from "@/lib/scraping/normalizeDisplayPrice";
import { roundSalePrice, type SalePriceBandResult } from "@/lib/sales/computeSalePriceBand";

export const AGENCY_GUIDE_REVIEW_THRESHOLD_PCT = 0.25;

export type AgencyGuidePriceBand = {
  displayPrice: string;
  priceMin: number;
  priceMax: number;
  priceMidpoint: number;
};

export type AgencyGuideReview = {
  required: boolean;
  confirmed: boolean;
  divergencePct: number;
  reasons: string[];
};

export type AgencyGuideBandResolution = {
  band: SalePriceBandResult;
  agencyGuide: AgencyGuidePriceBand | null;
  review: AgencyGuideReview | null;
};

const MIN_PLAUSIBLE_SALE_PRICE = 50_000;
const MAX_PLAUSIBLE_SALE_PRICE = 100_000_000;

/** Parse the subject listing's numeric agency guide without treating rent as a sale price. */
export function resolveAgencyGuidePriceBand(
  displayPrice?: string | null,
): AgencyGuidePriceBand | null {
  const guide = displayPrice?.trim();
  if (!guide || /(?:per\s+week|\/wk|weekly|per\s+annum|p\.a\.)/i.test(guide)) {
    return null;
  }

  const amounts = extractPropertyPriceAmounts(guide)
    .filter(
      (amount) =>
        Number.isFinite(amount) &&
        amount >= MIN_PLAUSIBLE_SALE_PRICE &&
        amount <= MAX_PLAUSIBLE_SALE_PRICE,
    )
    .map(roundSalePrice);

  if (amounts.length === 0) {
    return null;
  }

  const priceMin = Math.min(...amounts);
  const priceMax = Math.max(...amounts);

  return {
    displayPrice: guide,
    priceMin,
    priceMax,
    priceMidpoint: roundSalePrice((priceMin + priceMax) / 2),
  };
}

export function reviewAgencyGuideAgainstCompBand({
  agencyGuide,
  compBand,
  premiumTier,
  thresholdPct = AGENCY_GUIDE_REVIEW_THRESHOLD_PCT,
}: {
  agencyGuide: AgencyGuidePriceBand;
  compBand: SalePriceBandResult;
  premiumTier: boolean;
  thresholdPct?: number;
}): AgencyGuideReview {
  const divergencePct =
    agencyGuide.priceMidpoint > 0
      ? Math.abs(compBand.priceMidpoint - agencyGuide.priceMidpoint) /
        agencyGuide.priceMidpoint
      : 0;
  const required = divergencePct >= thresholdPct;
  const reasons: string[] = [];

  if (required) {
    reasons.push(
      `The comp-derived midpoint differs from the agency guide by ${Math.round(divergencePct * 100)}%.`,
    );
  }
  if (required && premiumTier) {
    reasons.push(
      "The subject is classified as premium, so ordinary same-bedroom comparables may not represent it well.",
    );
  }

  return {
    required,
    confirmed: false,
    divergencePct,
    reasons,
  };
}

/** Keep a numeric agency guide authoritative while retaining comp evidence for review. */
export function applyAgencyGuideToCompBand({
  displayPrice,
  compBand,
  premiumTier,
}: {
  displayPrice?: string | null;
  compBand: SalePriceBandResult;
  premiumTier: boolean;
}): AgencyGuideBandResolution {
  const agencyGuide = resolveAgencyGuidePriceBand(displayPrice);
  if (!agencyGuide) {
    return { band: compBand, agencyGuide: null, review: null };
  }

  return {
    band: {
      ...compBand,
      priceMin: agencyGuide.priceMin,
      priceMax: agencyGuide.priceMax,
      priceMidpoint: agencyGuide.priceMidpoint,
    },
    agencyGuide,
    review: reviewAgencyGuideAgainstCompBand({
      agencyGuide,
      compBand,
      premiumTier,
    }),
  };
}

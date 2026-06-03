import {
  detectPremiumRentSubject,
  type PremiumRentSubjectInput,
  type RentAppraisalTierSetting,
} from "@/lib/rental/detectPremiumRentSubject";
import type { ListingPremiumSignals } from "@/lib/rental/parseListingPremiumSignals";
import type { RentalComp } from "@/lib/rental/types";

export type RentBandResult = {
  weeklyMin: number;
  weeklyMax: number;
  weeklyMidpoint: number;
  compCount: number;
  featuredComps: RentalComp[];
};

export type RentBandTier = "standard" | "premium";

export type RentBandOptions = {
  subjectPropertyType?: string;
  preferSuburb?: string;
  maxFeaturedComps?: number;
  subjectBedrooms?: number;
  subjectBathrooms?: number;
  subjectCarSpaces?: number;
  /** Force standard or premium comp selection; default is inferred from signals. */
  tier?: RentBandTier;
  tierSetting?: RentAppraisalTierSetting;
  premiumSignals?: ListingPremiumSignals;
  /** Lower percentile for band min (default 0.35 standard, 0.25 premium). */
  percentileLow?: number;
  /** Upper percentile for band max (default 0.65 standard, 0.75 premium). */
  percentileHigh?: number;
  /** Drop comps beyond this fraction from median rent when enough remain (default 0.3 standard, 0.4 premium). */
  medianDeviationPct?: number;
};

export function isPremiumRentSubject(options?: RentBandOptions): boolean {
  return detectPremiumRentSubject(toPremiumInput(options)).premium;
}

function toPremiumInput(options?: RentBandOptions): PremiumRentSubjectInput {
  return {
    tier: options?.tier,
    tierSetting: options?.tierSetting,
    subjectBedrooms: options?.subjectBedrooms,
    subjectBathrooms: options?.subjectBathrooms,
    signals: options?.premiumSignals,
  };
}

function rentBandProfile(options?: RentBandOptions): RentBandOptions {
  const base = options ?? {};
  if (!isPremiumRentSubject(base)) {
    return base;
  }

  return {
    ...base,
    percentileLow: base.percentileLow ?? 0.25,
    percentileHigh: base.percentileHigh ?? 0.75,
    medianDeviationPct: base.medianDeviationPct ?? 0.4,
  };
}

const MIN_COMPS = 5;

function percentile(sorted: number[], p: number) {
  if (!sorted.length) {
    return 0;
  }
  const index = Math.floor((sorted.length - 1) * p);
  return sorted[index] ?? sorted[0]!;
}

export function propertyTypeFamily(propertyType?: string) {
  const normalized = propertyType?.trim().toLowerCase() ?? "";
  if (normalized.includes("apartment") || normalized.includes("unit")) {
    return "unit";
  }
  if (normalized.includes("townhouse")) {
    return "townhouse";
  }
  if (normalized.includes("house") || normalized.includes("villa")) {
    return "house";
  }
  return "other";
}

function matchesSubjectType(comp: RentalComp, subjectType?: string) {
  if (!subjectType?.trim()) {
    return true;
  }
  const subjectFamily = propertyTypeFamily(subjectType);
  const compFamily = propertyTypeFamily(comp.propertyType);
  if (subjectFamily === "other" || compFamily === "other") {
    return true;
  }
  return subjectFamily === compFamily;
}

function applyFilterIfEnough(
  comps: RentalComp[],
  predicate: (comp: RentalComp) => boolean,
  minKeep = MIN_COMPS,
): RentalComp[] {
  const next = comps.filter(predicate);
  return next.length >= minKeep ? next : comps;
}

function withinTolerance(actual?: number, target?: number, tolerance = 1) {
  if (target == null || actual == null) {
    return true;
  }
  return Math.abs(actual - target) <= tolerance;
}

/** Keep comps at or above the median rent of the current pool (drops cheap 5-bed / 2-bath stock). */
function filterUpperRentHalf(
  comps: RentalComp[],
  minKeep = MIN_COMPS,
): RentalComp[] {
  if (comps.length < minKeep) {
    return comps;
  }

  const rents = comps.map((comp) => comp.weeklyRent).sort((a, b) => a - b);
  const floor = percentile(rents, 0.5);
  const upper = comps.filter((comp) => comp.weeklyRent >= floor);
  return upper.length >= minKeep ? upper : comps;
}

function filterByMedianProximity(
  comps: RentalComp[],
  deviationPct = 0.3,
  minKeep = MIN_COMPS,
): RentalComp[] {
  if (comps.length < minKeep) {
    return comps;
  }

  const rents = comps.map((comp) => comp.weeklyRent).sort((a, b) => a - b);
  const median = percentile(rents, 0.5);
  const lo = median * (1 - deviationPct);
  const hi = median * (1 + deviationPct);
  const next = comps.filter(
    (comp) => comp.weeklyRent >= lo && comp.weeklyRent <= hi,
  );

  return next.length >= minKeep ? next : comps;
}

function subjectSimilarityScore(comp: RentalComp, options?: RentBandOptions) {
  if (!options) {
    return 0;
  }

  let score = 0;

  if (options.subjectBedrooms != null && comp.bedrooms != null) {
    const diff = Math.abs(comp.bedrooms - options.subjectBedrooms);
    if (diff === 0) {
      score += 10;
    } else if (diff === 1) {
      score += 4;
    } else {
      score -= 5;
    }
  }

  if (options.subjectBathrooms != null && comp.bathrooms != null) {
    const diff = Math.abs(comp.bathrooms - options.subjectBathrooms);
    if (diff === 0) {
      score += 8;
    } else if (diff === 1) {
      score += 3;
    } else {
      score -= 6;
    }
  }

  return score;
}

export function formatWeeklyRentRange(min: number, max: number) {
  const formatter = new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  });
  const low = formatter.format(min);
  const high = formatter.format(max);
  if (min === max) {
    return `${low} per week`;
  }
  return `${low} – ${high} per week`;
}

export function computeRentBandFromWeeklyRents(
  weeklyRents: number[],
  options?: RentBandOptions,
): RentBandResult | null {
  const rents = weeklyRents
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (rents.length < MIN_COMPS) {
    return null;
  }

  const trimmed = rents.filter((rent) => {
    const lo = percentile(rents, 0.15);
    const hi = percentile(rents, 0.85);
    return rent >= lo && rent <= hi;
  });

  const pool = trimmed.length >= MIN_COMPS ? trimmed : rents;
  const pLow = options?.percentileLow ?? 0.35;
  const pHigh = options?.percentileHigh ?? 0.65;
  const weeklyMin = percentile(pool, pLow);
  const weeklyMax = percentile(pool, pHigh);
  const weeklyMidpoint = percentile(pool, 0.5);

  return {
    weeklyMin,
    weeklyMax,
    weeklyMidpoint,
    compCount: pool.length,
    featuredComps: [],
  };
}

export function computeRentBandFromComps(
  comps: RentalComp[],
  options?: RentBandOptions,
): RentBandResult | null {
  const profile = rentBandProfile(options);
  const premium = isPremiumRentSubject(profile);
  const maxFeatured = profile.maxFeaturedComps ?? 4;

  let filtered = comps.filter((comp) => comp.weeklyRent > 0);

  if (profile.subjectPropertyType) {
    filtered = applyFilterIfEnough(filtered, (comp) =>
      matchesSubjectType(comp, profile.subjectPropertyType),
    );
  }

  if (profile.preferSuburb?.trim()) {
    const preferSuburb = profile.preferSuburb.trim().toLowerCase();
    filtered = applyFilterIfEnough(
      filtered,
      (comp) => comp.suburb?.trim().toLowerCase() === preferSuburb,
    );
  }

  if (profile.subjectBedrooms != null) {
    filtered = applyFilterIfEnough(
      filtered,
      (comp) => comp.bedrooms === profile.subjectBedrooms,
    );
    filtered = applyFilterIfEnough(filtered, (comp) =>
      withinTolerance(comp.bedrooms, profile.subjectBedrooms, 1),
    );
  }

  if (profile.subjectBathrooms != null) {
    if (premium) {
      filtered = applyFilterIfEnough(
        filtered,
        (comp) => comp.bathrooms === profile.subjectBathrooms,
      );
    }
    filtered = applyFilterIfEnough(filtered, (comp) =>
      withinTolerance(comp.bathrooms, profile.subjectBathrooms, 1),
    );
    if (premium) {
      filtered = filterUpperRentHalf(filtered);
    }
  }

  filtered = filterByMedianProximity(
    filtered,
    profile.medianDeviationPct ?? (premium ? 0.4 : 0.3),
  );

  const band = computeRentBandFromWeeklyRents(
    filtered.map((comp) => comp.weeklyRent),
    profile,
  );

  if (!band) {
    return null;
  }

  const midpoint = band.weeklyMidpoint;
  const featuredComps = [...filtered]
    .sort((a, b) => {
      const scoreDiff =
        subjectSimilarityScore(b, profile) - subjectSimilarityScore(a, profile);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return (
        Math.abs(a.weeklyRent - midpoint) - Math.abs(b.weeklyRent - midpoint)
      );
    })
    .slice(0, maxFeatured);

  return {
    ...band,
    featuredComps,
  };
}

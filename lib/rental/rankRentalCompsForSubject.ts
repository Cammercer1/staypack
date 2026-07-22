import {
  matchesSubjectPropertyType,
  propertyTypeFamily,
} from "@/lib/rental/computeRentBand";
import { resolveRentalCompPropertyType } from "@/lib/rental/resolveRentalCompPropertyType";
import { MIN_RENT_COMPS_FOR_BAND } from "@/lib/rental/rentCompThresholds";
import type { RentalComp } from "@/lib/rental/types";

export type RankRentalCompsInput = {
  suburb?: string;
  bedrooms?: number;
  bathrooms?: number;
  carSpaces?: number;
  subjectPropertyType?: string;
};

export type RentalCompSelectionTier =
  | "exact"
  | "upper_band_unit_fallback"
  | "other";

function normalizeSuburb(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

export function rentalCompSubjectScore(
  comp: RentalComp,
  input: RankRentalCompsInput,
): number {
  let score = 0;
  const subjectSuburb = normalizeSuburb(input.suburb);
  const compSuburb = normalizeSuburb(comp.suburb);

  if (subjectSuburb && compSuburb === subjectSuburb) {
    score += 100;
  } else if (subjectSuburb && compSuburb) {
    score -= 15;
  }

  if (input.bedrooms != null && comp.bedrooms != null) {
    const diff = Math.abs(comp.bedrooms - input.bedrooms);
    if (diff === 0) {
      score += 10;
    } else if (diff === 1) {
      score += 4;
    } else {
      score -= 8;
    }
  }

  if (input.bathrooms != null && comp.bathrooms != null) {
    const diff = Math.abs(comp.bathrooms - input.bathrooms);
    if (diff === 0) {
      score += 6;
    } else if (diff === 1) {
      score += 2;
    } else {
      score -= 4;
    }
  }

  if (input.carSpaces != null && comp.carSpaces != null) {
    const diff = Math.abs(comp.carSpaces - input.carSpaces);
    if (diff === 0) {
      score += 4;
    } else if (diff === 1) {
      score += 1;
    } else {
      score -= 3;
    }
  }

  if (input.subjectPropertyType?.trim()) {
    const subjectFamily = propertyTypeFamily(input.subjectPropertyType);
    const compFamily = propertyTypeFamily(resolveRentalCompPropertyType(comp));
    if (subjectFamily !== "other" && compFamily === subjectFamily) {
      score += 80;
    } else if (compFamily !== "other" && compFamily !== subjectFamily) {
      score -= 200;
    }
  }

  return score;
}

/** Keep only comps that match subject property type when enough exist. */
export function filterRentalCompsForSubjectType(
  comps: RentalComp[],
  subjectPropertyType?: string,
): RentalComp[] {
  if (!subjectPropertyType?.trim()) {
    return comps;
  }
  const matched = comps.filter((comp) =>
    matchesSubjectPropertyType(comp, subjectPropertyType),
  );
  return matched.length >= MIN_RENT_COMPS_FOR_BAND ? matched : comps;
}

export function rankRentalCompsForSubject(
  comps: RentalComp[],
  input: RankRentalCompsInput,
): RentalComp[] {
  return [...comps].sort(
    (a, b) => rentalCompSubjectScore(b, input) - rentalCompSubjectScore(a, input),
  );
}

function percentile(sorted: number[], proportion: number) {
  if (sorted.length === 0) {
    return null;
  }
  const index = Math.floor((sorted.length - 1) * proportion);
  return sorted[index] ?? sorted[0] ?? null;
}

function upperBandUnitFallbacks(
  comps: RentalComp[],
  exactComps: RentalComp[],
  input: RankRentalCompsInput,
) {
  const unitComps = comps.filter(
    (comp) =>
      propertyTypeFamily(resolveRentalCompPropertyType(comp)) === "unit" &&
      (input.bedrooms == null ||
        comp.bedrooms == null ||
        comp.bedrooms === input.bedrooms),
  );

  if (unitComps.length === 0) {
    return [];
  }

  const unitRents = unitComps
    .map((comp) => comp.weeklyRent)
    .filter((rent) => Number.isFinite(rent) && rent > 0)
    .sort((a, b) => a - b);
  const exactRents = exactComps
    .map((comp) => comp.weeklyRent)
    .filter((rent) => Number.isFinite(rent) && rent > 0)
    .sort((a, b) => a - b);
  const unitMedian = percentile(unitRents, 0.5) ?? 0;
  const exactLowerQuartile = percentile(exactRents, 0.25) ?? 0;
  const fallbackFloor = Math.max(unitMedian, exactLowerQuartile);
  const referenceRent = percentile(exactRents, 0.5) ?? unitMedian;

  return unitComps
    .filter((comp) => comp.weeklyRent >= fallbackFloor)
    .sort((a, b) => {
      const scoreInput = { ...input, subjectPropertyType: undefined };
      const scoreDiff =
        rentalCompSubjectScore(b, scoreInput) -
        rentalCompSubjectScore(a, scoreInput);
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return (
        Math.abs(a.weeklyRent - referenceRent) -
        Math.abs(b.weeklyRent - referenceRent)
      );
    });
}

/**
 * Picker/report pool: exact type first. Townhouses may use upper-band units only
 * as secondary display evidence when there are fewer than six exact matches.
 */
export function buildRentalCompSelectionPool(
  comps: RentalComp[],
  input: RankRentalCompsInput,
  targetCount = 6,
): RentalComp[] {
  if (!input.subjectPropertyType?.trim()) {
    return rankRentalCompsForSubject(comps, input);
  }

  const exact = rankRentalCompsForSubject(
    comps.filter((comp) =>
      matchesSubjectPropertyType(comp, input.subjectPropertyType),
    ),
    input,
  );

  if (propertyTypeFamily(input.subjectPropertyType) !== "townhouse") {
    return exact;
  }

  if (exact.length >= targetCount) {
    return exact;
  }

  return [
    ...exact,
    ...upperBandUnitFallbacks(comps, exact, input),
  ];
}

export function rentalCompSelectionTier(
  comp: RentalComp,
  subjectPropertyType?: string,
): RentalCompSelectionTier {
  if (
    !subjectPropertyType?.trim() ||
    matchesSubjectPropertyType(comp, subjectPropertyType)
  ) {
    return "exact";
  }
  if (
    propertyTypeFamily(subjectPropertyType) === "townhouse" &&
    propertyTypeFamily(resolveRentalCompPropertyType(comp)) === "unit"
  ) {
    return "upper_band_unit_fallback";
  }
  return "other";
}

export function countSameSuburbComps(
  comps: RentalComp[],
  suburb?: string,
): number {
  const subjectSuburb = normalizeSuburb(suburb);
  if (!subjectSuburb) {
    return comps.length;
  }
  return comps.filter((comp) => normalizeSuburb(comp.suburb) === subjectSuburb).length;
}

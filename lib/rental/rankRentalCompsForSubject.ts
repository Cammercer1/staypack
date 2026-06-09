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
  subjectPropertyType?: string;
};

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

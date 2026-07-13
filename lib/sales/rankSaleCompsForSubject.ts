import { propertyTypeFamily } from "@/lib/rental/computeRentBand";
import { MIN_RENT_COMPS_FOR_BAND } from "@/lib/rental/rentCompThresholds";
import type { SaleComp } from "@/lib/sales/types";

/** Strata-style address e.g. 2/121 Alison Road, 401/2 Roscrea Avenue. */
const UNIT_ADDRESS_PATTERN = /\d+\s*\/\s*\d+/;

/** REA often labels apartments as duplex/semi-detached. Infer unit from address. */
export function resolveSaleCompPropertyType(comp: SaleComp): string | undefined {
  const address = comp.address?.trim() ?? "";
  if (UNIT_ADDRESS_PATTERN.test(address)) {
    return "Unit";
  }
  return comp.propertyType?.trim() || undefined;
}

export function matchesSaleSubjectPropertyType(
  comp: SaleComp,
  subjectType?: string,
): boolean {
  if (!subjectType?.trim()) {
    return true;
  }
  const subjectFamily = propertyTypeFamily(subjectType);
  const compFamily = propertyTypeFamily(resolveSaleCompPropertyType(comp));
  if (subjectFamily === "other") {
    return true;
  }
  if (compFamily === "other") {
    return false;
  }
  return subjectFamily === compFamily;
}

export type RankSaleCompsInput = {
  suburb?: string;
  bedrooms?: number;
  bathrooms?: number;
  subjectPropertyType?: string;
};

function normalizeSuburb(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

export function saleCompSubjectScore(
  comp: SaleComp,
  input: RankSaleCompsInput,
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
    const compFamily = propertyTypeFamily(resolveSaleCompPropertyType(comp));
    if (subjectFamily !== "other" && compFamily === subjectFamily) {
      score += 80;
    } else if (compFamily !== "other" && compFamily !== subjectFamily) {
      score -= 200;
    }
  }

  return score;
}

function bedroomDistance(comp: SaleComp, bedrooms?: number) {
  if (bedrooms == null || comp.bedrooms == null) {
    return 99;
  }
  return Math.abs(comp.bedrooms - bedrooms);
}

function bathroomDistance(comp: SaleComp, bathrooms?: number) {
  if (bathrooms == null || comp.bathrooms == null) {
    return 99;
  }
  return Math.abs(comp.bathrooms - bathrooms);
}

/** Keep only comps that match subject property type when enough exist. */
export function filterSaleCompsForSubjectType(
  comps: SaleComp[],
  subjectPropertyType?: string,
): SaleComp[] {
  if (!subjectPropertyType?.trim()) {
    return comps;
  }
  const matched = comps.filter((comp) =>
    matchesSaleSubjectPropertyType(comp, subjectPropertyType),
  );
  return matched.length >= MIN_RENT_COMPS_FOR_BAND ? matched : comps;
}

export function rankSaleCompsForSubject(
  comps: SaleComp[],
  input: RankSaleCompsInput,
): SaleComp[] {
  return [...comps].sort((a, b) => {
    const scoreDiff = saleCompSubjectScore(b, input) - saleCompSubjectScore(a, input);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    const bedDiff = bedroomDistance(a, input.bedrooms) - bedroomDistance(b, input.bedrooms);
    if (bedDiff !== 0) {
      return bedDiff;
    }

    const bathDiff =
      bathroomDistance(a, input.bathrooms) - bathroomDistance(b, input.bathrooms);
    if (bathDiff !== 0) {
      return bathDiff;
    }

    return (a.address ?? "").localeCompare(b.address ?? "");
  });
}

export function countSameSuburbSaleComps(
  comps: SaleComp[],
  suburb?: string,
): number {
  const subjectSuburb = normalizeSuburb(suburb);
  if (!subjectSuburb) {
    return comps.length;
  }
  return comps.filter((comp) => normalizeSuburb(comp.suburb) === subjectSuburb).length;
}

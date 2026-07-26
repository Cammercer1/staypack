import { propertyTypeFamily } from "@/lib/rental/computeRentBand";
import type { SaleComp } from "@/lib/sales/types";
import { parseStreetAddress } from "@/lib/scraping/domain/addressMatch";
import type { ParsedListing } from "@/lib/types";

/** Strata-style address e.g. 2/121 Alison Road, 401/2 Roscrea Avenue. */
const UNIT_ADDRESS_PATTERN = /\d+\s*\/\s*\d+/;

/** REA often labels apartments as duplex/semi-detached. Infer unit from address. */
export function resolveSaleCompPropertyType(comp: SaleComp): string | undefined {
  const declared = comp.propertyType?.trim();
  if (declared) {
    return declared;
  }
  const address = comp.address?.trim() ?? "";
  if (UNIT_ADDRESS_PATTERN.test(address)) {
    return "Unit";
  }
  return undefined;
}

/** Prefer the provider's declared subject type; infer from address only when absent. */
export function resolveSaleSubjectPropertyType(
  listing: ParsedListing,
): string | undefined {
  const declared = listing.propertyType?.trim();
  if (declared) {
    return declared;
  }
  return UNIT_ADDRESS_PATTERN.test(listing.address?.trim() ?? "")
    ? "Unit"
    : undefined;
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
  carSpaces?: number;
  floorAreaSqm?: number;
  subjectAddress?: string;
  targetPrice?: number;
  subjectPropertyType?: string;
};

function normalizeSuburb(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function relativeDifference(actual: number, target: number) {
  return target > 0 ? Math.abs(actual - target) / target : Number.POSITIVE_INFINITY;
}

function sameStreet(compAddress: string, subjectAddress?: string) {
  if (!subjectAddress?.trim()) return false;
  const subject = parseStreetAddress({ address: subjectAddress });
  const comp = parseStreetAddress({ address: compAddress });
  return Boolean(
    subject.streetName &&
      comp.streetName &&
      subject.streetName === comp.streetName,
  );
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

  if (input.carSpaces != null && comp.carSpaces != null) {
    const diff = Math.abs(comp.carSpaces - input.carSpaces);
    if (diff === 0) {
      score += 10;
    } else if (diff === 1) {
      score -= 2;
    } else {
      score -= 8;
    }
  }

  if (input.floorAreaSqm != null && comp.floorAreaSqm != null) {
    const diff = relativeDifference(comp.floorAreaSqm, input.floorAreaSqm);
    if (diff <= 0.15) {
      score += 12;
    } else if (diff <= 0.3) {
      score += 5;
    } else if (diff > 0.5) {
      score -= 8;
    }
  }

  if (sameStreet(comp.address, input.subjectAddress)) {
    score += 30;
  }

  if (input.targetPrice != null && input.targetPrice > 0 && comp.price > 0) {
    const diff = relativeDifference(comp.price, input.targetPrice);
    if (diff <= 0.05) {
      score += 40;
    } else if (diff <= 0.1) {
      score += 30;
    } else if (diff <= 0.2) {
      score += 15;
    } else if (diff > 0.35) {
      score -= 35;
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

/** Sales evidence never falls back to a different property-type family. */
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
  return matched;
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

    if (input.targetPrice != null && input.targetPrice > 0) {
      const priceDiff =
        Math.abs(a.price - input.targetPrice) -
        Math.abs(b.price - input.targetPrice);
      if (priceDiff !== 0) {
        return priceDiff;
      }
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

export type AddressMatchInput = {
  address?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
};

export type ParsedStreetAddress = {
  streetNumber: string | null;
  streetName: string | null;
  suburb: string | null;
  state: string | null;
  postcode: string | null;
};

function normalizeToken(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9/]+/g, " ")
    .trim();
}

export function slugifySuburbSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseStreetAddress(input: AddressMatchInput): ParsedStreetAddress {
  const suburb = input.suburb?.trim() ?? null;
  const state = input.state?.trim().toUpperCase() ?? null;
  const postcode = input.postcode?.trim() ?? null;

  let streetPart = input.address?.trim() ?? "";
  if (streetPart.includes(",")) {
    streetPart = streetPart.split(",")[0]?.trim() ?? streetPart;
  }

  if (!streetPart) {
    return {
      streetNumber: null,
      streetName: null,
      suburb,
      state,
      postcode,
    };
  }

  const spacedUnitMatch = streetPart.match(/^(\d+)\s+(\d+)\s+(.+)$/i);
  if (spacedUnitMatch) {
    const streetNumber = `${spacedUnitMatch[1]}/${spacedUnitMatch[2]}`;
    let streetName = spacedUnitMatch[3].trim();
    for (const suffix of [
      " road",
      " rd",
      " street",
      " st",
      " avenue",
      " ave",
      " drive",
      " dr",
      " parade",
      " pde",
      " court",
      " ct",
      " place",
      " pl",
      " lane",
      " ln",
      " way",
      " crescent",
      " cres",
      " circuit",
      " cct",
      " close",
      " cl",
    ]) {
      if (streetName.toLowerCase().endsWith(suffix)) {
        streetName = streetName.slice(0, -suffix.length).trim();
        break;
      }
    }

    return {
      streetNumber,
      streetName: normalizeToken(streetName) || null,
      suburb: suburb ? normalizeToken(suburb) : null,
      state,
      postcode,
    };
  }

  const unitMatch = streetPart.match(/^(\d+\s*\/\s*\d+|\d+[a-z]?)\s+(.+)$/i);
  if (!unitMatch) {
    return {
      streetNumber: null,
      streetName: normalizeToken(streetPart) || null,
      suburb,
      state,
      postcode,
    };
  }

  const streetNumber = unitMatch[1].replace(/\s+/g, "");
  let streetName = unitMatch[2].trim();

  for (const suffix of [
    " road",
    " rd",
    " street",
    " st",
    " avenue",
    " ave",
    " drive",
    " dr",
    " parade",
    " pde",
    " court",
    " ct",
    " place",
    " pl",
    " lane",
    " ln",
    " way",
    " crescent",
    " cres",
    " circuit",
    " cct",
    " close",
    " cl",
  ]) {
    if (streetName.toLowerCase().endsWith(suffix)) {
      streetName = streetName.slice(0, -suffix.length).trim();
      break;
    }
  }

  return {
    streetNumber,
    streetName: normalizeToken(streetName) || null,
    suburb: suburb ? normalizeToken(suburb) : null,
    state,
    postcode,
  };
}

type DomainListingAddress = {
  street?: string;
  suburb?: string;
  state?: string;
  postcode?: string;
};

export function domainListingMatchesAddress(
  listingAddress: DomainListingAddress,
  target: ParsedStreetAddress,
) {
  if (!listingAddress.street) {
    return false;
  }

  const candidate = parseStreetAddress({
    address: listingAddress.street,
    suburb: listingAddress.suburb,
    state: listingAddress.state,
    postcode: listingAddress.postcode,
  });

  const normalizeUnitNumber = (value: string | null) =>
    value?.replace(/\s+/g, "").replace(/-/g, "/").toLowerCase() ?? null;

  const targetUnit = normalizeUnitNumber(target.streetNumber);
  const candidateUnit = normalizeUnitNumber(candidate.streetNumber);

  if (targetUnit && candidateUnit && targetUnit !== candidateUnit) {
    return false;
  }

  if (target.streetName && candidate.streetName) {
    const targetName = target.streetName;
    const candidateName = candidate.streetName;
    if (
      targetName !== candidateName &&
      !candidateName.includes(targetName) &&
      !targetName.includes(candidateName)
    ) {
      return false;
    }
  }

  if (target.suburb && candidate.suburb && target.suburb !== candidate.suburb) {
    return false;
  }

  if (target.postcode && candidate.postcode && target.postcode !== candidate.postcode) {
    return false;
  }

  if (target.state && candidate.state && target.state !== candidate.state) {
    return false;
  }

  return Boolean(target.streetNumber || target.streetName);
}

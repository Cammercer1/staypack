import { propertyIdentity, sameProperty } from "@/lib/listings/propertyIdentity";
import type { PropertyCandidate } from "@/lib/listings/propertyLookupTypes";

type Address = Parameters<typeof sameProperty>[0];

/** Candidate discovery only. A linked listing must independently verify this alias. */
export function isProfileRangeAliasCandidate(left: Address, right: Address) {
  const a = propertyIdentity({ ...left, suburb: left.suburb || right.suburb });
  const b = propertyIdentity({ ...right, suburb: right.suburb || left.suburb });
  const apartment = /^(\d+[a-z]?)\/(\d+[a-z]?)(?:-(\d+[a-z]?))? (.+)$/;
  const x = a.address.match(apartment);
  const y = b.address.match(apartment);
  if (!x || !y || Boolean(x[3]) === Boolean(y[3])) return false;
  return sameProperty(
    { ...left, property_address: `${x[1]}/${x[2]} ${x[4]}` },
    { ...right, property_address: `${y[1]}/${y[2]} ${y[4]}` },
  );
}

export function selectProfileCandidate(candidates: PropertyCandidate[], expected: Address) {
  const addressOf = (candidate: PropertyCandidate): Address => ({
    property_address: candidate.streetAddress,
    suburb: candidate.suburb,
    state: candidate.state,
    postcode: candidate.postcode,
  });
  const exact = candidates.find((candidate) => sameProperty(expected, addressOf(candidate)));
  if (exact) return exact;
  const aliases = candidates.filter((candidate) => isProfileRangeAliasCandidate(expected, addressOf(candidate)));
  if (aliases.length !== 1) return undefined;
  // Preserve the requested address so lookup must verify the alias against a linked listing.
  return {
    ...aliases[0],
    streetAddress: expected.property_address!,
    address: [expected.property_address, expected.suburb, expected.state, expected.postcode].filter(Boolean).join(" "),
  };
}

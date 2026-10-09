import type { ExistingProperty } from "./propertyLookupTypes";

type Address = Partial<Omit<ExistingProperty, "id">>;
const suffixes: Record<string, string> = {
  street: "st",
  road: "rd",
  avenue: "ave",
  parade: "pde",
  crescent: "cres",
  drive: "dr",
  court: "ct",
  place: "pl",
  lane: "ln",
  circuit: "cct",
  close: "cl",
};
function normalize(value: string | null | undefined) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[–—]/g, "-")
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
}
export function propertyIdentity(input: Address) {
  let address = normalize(input.property_address).replace(
    /^(?:unit|apartment|apt)\s+/,
    "",
  );
  const full = address;
  address = address.split(",")[0];
  // Also accept a full address entered without commas, keeping unit/range intact.
  const suburb = normalize(input.suburb);
  if (suburb && address.endsWith(suburb))
    address = address.slice(0, -suburb.length).trim();
  address = address.replace(
    /\s+(?:nsw|vic|qld|sa|wa|tas|nt|act)(?:\s+\d{4})?(?:\s+australia)?$/,
    "",
  );
  if (suburb && address.endsWith(suburb))
    address = address.slice(0, -suburb.length).trim();
  address = address
    .replace(/\s*([/-])\s*/g, "$1")
    .replace(
      /\b(street|road|avenue|parade|crescent|drive|court|place|lane|circuit|close)\b/g,
      (word) => suffixes[word],
    );
  const state =
    normalize(input.state) ||
    full.match(/\b(nsw|vic|qld|sa|wa|tas|nt|act)\b/)?.[1] ||
    "";
  const postcode =
    normalize(input.postcode) ||
    full.match(/\b\d{4}\b(?=\s*(?:australia)?$)/)?.[0] ||
    "";
  return { address, suburb, state, postcode };
}
export function sameProperty(left: Address, right: Address) {
  // Use known locality to strip a full display address on either side.
  const a = propertyIdentity({ ...left, suburb: left.suburb || right.suburb });
  const b = propertyIdentity({ ...right, suburb: right.suburb || left.suburb });
  if (!a.address || a.address !== b.address) return false;
  if (a.state && b.state && a.state !== b.state) return false;
  if (a.postcode && b.postcode && a.postcode !== b.postcode) return false;
  if (a.suburb && b.suburb && a.suburb !== b.suburb) return false;
  return Boolean((a.postcode && b.postcode) || (a.suburb && b.suburb));
}

import type { RentalComp } from "@/lib/rental/types";

export function rentalCompDedupeKey(comp: RentalComp) {
  // Listing IDs change when a property is re-advertised. Keep the unit number
  // and suburb in the identity so separate apartments never collapse together.
  const normalize = (value: string) => value.trim().toLowerCase().replace(/[,\s]+/g, " ").trim();
  const address = normalize(comp.address ?? "");
  const suburb = normalize(comp.suburb ?? "");
  if (suburb && /\d/.test(address) && /[a-z]/.test(address)) {
    const street = address.endsWith(` ${suburb}`) ? address.slice(0, -suburb.length).trim() : address;
    return `property:${street}|${suburb}`;
  }
  const url = comp.listingUrl?.trim();
  if (url) {
    return url;
  }
  return `${comp.address ?? ""}|${comp.weeklyRent}|${comp.suburb ?? ""}`;
}

export function mergeRentalComps(
  existing: RentalComp[],
  incoming: RentalComp[],
): RentalComp[] {
  const seen = new Set<string>();
  const seenUrls = new Set<string>();
  const merged: RentalComp[] = [];

  for (const comp of [...existing, ...incoming]) {
    const key = rentalCompDedupeKey(comp);
    const url = comp.listingUrl?.trim();
    if (seen.has(key) || (url && seenUrls.has(url))) {
      continue;
    }
    seen.add(key);
    if (url) seenUrls.add(url);
    merged.push(comp);
  }

  return merged;
}

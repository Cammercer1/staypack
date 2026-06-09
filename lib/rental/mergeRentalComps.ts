import type { RentalComp } from "@/lib/rental/types";

export function rentalCompDedupeKey(comp: RentalComp) {
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
  const seen = new Set(existing.map(rentalCompDedupeKey));
  const merged = [...existing];

  for (const comp of incoming) {
    const key = rentalCompDedupeKey(comp);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(comp);
  }

  return merged;
}

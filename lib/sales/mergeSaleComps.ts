import type { SaleComp } from "@/lib/sales/types";

export function saleCompDedupeKey(comp: SaleComp) {
  const url = comp.listingUrl?.trim();
  if (url) {
    return url;
  }
  return `${comp.address ?? ""}|${comp.price}|${comp.suburb ?? ""}`;
}

export function mergeSaleComps(
  existing: SaleComp[],
  incoming: SaleComp[],
): SaleComp[] {
  const seen = new Set(existing.map(saleCompDedupeKey));
  const merged = [...existing];

  for (const comp of incoming) {
    const key = saleCompDedupeKey(comp);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(comp);
  }

  return merged;
}

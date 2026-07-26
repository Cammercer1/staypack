import type { SaleComp } from "@/lib/sales/types";
import { parseStreetAddress } from "@/lib/scraping/domain/addressMatch";

export function saleCompDedupeKey(comp: SaleComp) {
  const url = comp.listingUrl?.trim();
  if (url) {
    return url;
  }
  return `${comp.address ?? ""}|${comp.price}|${comp.suburb ?? ""}`;
}

function canonicalStreetNumber(value: string | null) {
  return value
    ?.toLowerCase()
    .replace(/\s+/g, "")
    .split("/")
    .map((part) => part.split("-")[0])
    .join("/");
}

function saleCompAddressPriceKey(comp: SaleComp) {
  const parsed = parseStreetAddress({
    address: comp.address,
    suburb: comp.suburb,
  });
  return [
    canonicalStreetNumber(parsed.streetNumber),
    parsed.streetName,
    parsed.suburb,
    comp.price,
  ].join("|");
}

export function mergeSaleComps(
  existing: SaleComp[],
  incoming: SaleComp[],
): SaleComp[] {
  const seen = new Set(
    existing.flatMap((comp) => [
      saleCompDedupeKey(comp),
      saleCompAddressPriceKey(comp),
    ]),
  );
  const merged = [...existing];

  for (const comp of incoming) {
    const keys = [saleCompDedupeKey(comp), saleCompAddressPriceKey(comp)];
    if (keys.some((key) => seen.has(key))) {
      continue;
    }
    keys.forEach((key) => seen.add(key));
    merged.push(comp);
  }

  return merged;
}

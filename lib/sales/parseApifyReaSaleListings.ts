import type { ApifyReaListingRecord } from "@/lib/apify/types";
import type { ReaSaleChannel } from "@/lib/sales/buildReaSaleSearchUrl";
import {
  parseSalePriceFromDisplay,
  plausibleSalePrice,
} from "@/lib/sales/parseSalePrice";
import type { SaleComp, SaleCompStatus } from "@/lib/sales/types";
import { normalizeReaImageUrl } from "@/lib/scraping/rea/normalizeReaImageUrl";
import {
  resolveReaFloorAreaSqm,
  resolveReaLandAreaSqm,
  resolveReaSoldDate,
} from "@/lib/scraping/rea/parseReaPropertyFacts";
import { parseLandAreaSqm } from "@/lib/rental/parseListingPremiumSignals";

function resolveSalePrice(record: ApifyReaListingRecord): number | null {
  const structured = record.listing?.price;
  if (structured?.value != null) {
    const period = structured.period?.trim().toLowerCase();
    if (!period || period.includes("year")) {
      const value = plausibleSalePrice(structured.value);
      if (value != null) {
        return value;
      }
    }
  }

  return (
    parseSalePriceFromDisplay(record.price) ??
    parseSalePriceFromDisplay(structured?.display)
  );
}

function resolveSaleStatus(
  record: ApifyReaListingRecord,
  channel: ReaSaleChannel,
): SaleCompStatus {
  const recordChannel = record.channel?.trim().toLowerCase();
  const status = record.status?.trim().toLowerCase();
  if (recordChannel === "sold" || status?.includes("sold")) {
    return "sold";
  }
  if (recordChannel === "buy" || record.isBuy) {
    return "for_sale";
  }
  return channel === "sold" ? "sold" : "for_sale";
}

export function apifyReaRecordToSaleComp(
  record: ApifyReaListingRecord,
  channel: ReaSaleChannel,
): SaleComp | null {
  const recordChannel = record.channel?.trim().toLowerCase();
  if (recordChannel === "rent" || record.isRent) {
    return null;
  }

  const price = resolveSalePrice(record);
  if (price == null) {
    return null;
  }

  const street = record.address?.trim();
  const suburb = record.suburb?.trim();
  if (!street && !suburb) {
    return null;
  }

  const address = street && suburb ? `${street}, ${suburb}` : street ?? suburb ?? "";
  const rawImage = record.images?.find(
    (url) => typeof url === "string" && url.startsWith("http"),
  );

  const saleStatus = resolveSaleStatus(record, channel);

  return {
    address,
    suburb,
    price,
    saleStatus,
    soldDate: saleStatus === "sold" ? resolveReaSoldDate(record) : undefined,
    landAreaSqm:
      resolveReaLandAreaSqm(record) ??
      (record.description?.trim()
        ? parseLandAreaSqm(record.description)
        : undefined),
    floorAreaSqm: resolveReaFloorAreaSqm(record),
    priceDisplay: record.price?.trim() || record.listing?.price?.display?.trim() || undefined,
    bedrooms: record.bedrooms ?? undefined,
    bathrooms: record.bathrooms ?? undefined,
    carSpaces: record.carSpaces ?? undefined,
    propertyType: record.propertyType?.trim() || undefined,
    imageUrl: rawImage ? normalizeReaImageUrl(rawImage) : undefined,
    listingUrl: record.url,
  };
}

export function parseApifyReaSaleListings(
  records: ApifyReaListingRecord[],
  channel: ReaSaleChannel,
): SaleComp[] {
  const comps: SaleComp[] = [];

  for (const record of records) {
    const comp = apifyReaRecordToSaleComp(record, channel);
    if (comp) {
      comps.push(comp);
    }
  }

  return comps;
}

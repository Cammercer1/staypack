import type { BrightDataReaRecord } from "@/lib/brightdata/types";
import type { ReaSaleChannel } from "@/lib/sales/buildReaSaleSearchUrl";
import {
  parseSalePriceFromDisplay,
  plausibleSalePrice,
} from "@/lib/sales/parseSalePrice";
import type { SaleComp, SaleCompStatus } from "@/lib/sales/types";
import { normalizeReaImageUrl } from "@/lib/scraping/rea/normalizeReaImageUrl";

function parseCount(value: string | number | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function resolveSalePrice(record: BrightDataReaRecord): {
  price: number | null;
  priceDisplay?: string;
} {
  const raw = record as Record<string, unknown>;

  // Sold / listing price fields vary across Bright Data REA snapshots.
  for (const key of ["sold_price", "sale_price", "price", "listing_price"]) {
    const value = raw[key];
    const numeric = plausibleSalePrice(value);
    if (numeric != null) {
      return {
        price: numeric,
        priceDisplay: typeof value === "string" ? value.trim() : undefined,
      };
    }
    if (typeof value === "string") {
      const parsed = parseSalePriceFromDisplay(value);
      if (parsed != null) {
        return { price: parsed, priceDisplay: value.trim() };
      }
    }
  }

  if (record.estimated_price) {
    const parsed =
      parseSalePriceFromDisplay(record.estimated_price) ??
      plausibleSalePrice(record.estimated_price);
    if (parsed != null) {
      return { price: parsed, priceDisplay: record.estimated_price.trim() };
    }
  }

  return { price: null };
}

function resolveSaleStatus(
  record: BrightDataReaRecord,
  channel: ReaSaleChannel,
): SaleCompStatus {
  const listingType = record.listing_type?.trim().toLowerCase();
  if (listingType?.includes("sold")) {
    return "sold";
  }
  if (listingType === "buy" || listingType === "sale") {
    return "for_sale";
  }
  return channel === "sold" ? "sold" : "for_sale";
}

function resolveSoldDate(record: BrightDataReaRecord): string | undefined {
  const raw = record as Record<string, unknown>;
  for (const key of ["sold_date", "date_sold", "soldDate"]) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

export function reaRecordToSaleComp(
  record: BrightDataReaRecord,
  channel: ReaSaleChannel,
): SaleComp | null {
  const listingType = record.listing_type?.trim().toLowerCase();
  if (listingType === "rent") {
    return null;
  }

  const { price, priceDisplay } = resolveSalePrice(record);
  if (price == null) {
    return null;
  }

  const street = record.street_address?.trim();
  const suburb = record.suburb?.trim();
  if (!street && !suburb) {
    return null;
  }

  const address = street && suburb ? `${street}, ${suburb}` : street ?? suburb ?? "";
  const rawImage = record.images_urls?.find(
    (url) => typeof url === "string" && url.startsWith("http"),
  );

  const saleStatus = resolveSaleStatus(record, channel);

  return {
    address,
    suburb,
    price,
    saleStatus,
    soldDate: saleStatus === "sold" ? resolveSoldDate(record) : undefined,
    priceDisplay,
    bedrooms: parseCount(record.bedrooms),
    bathrooms: parseCount(record.bathrooms),
    propertyType: record.property_type ?? record.house_type,
    imageUrl: rawImage ? normalizeReaImageUrl(rawImage) : undefined,
    listingUrl: record.url,
  };
}

export function parseReaSaleDiscoverRecords(
  records: BrightDataReaRecord[],
  channel: ReaSaleChannel,
): SaleComp[] {
  const comps: SaleComp[] = [];

  for (const record of records) {
    const comp = reaRecordToSaleComp(record, channel);
    if (comp) {
      comps.push(comp);
    }
  }

  return comps;
}

import { fetchPropRadarSuburbStats, hasPropRadarConfig } from "@/lib/propradar/client";
import { mapPropRadarSuburbToLtrMarket } from "@/lib/propradar/mapSuburbStatsForProperty";
import type { ParsedListing } from "@/lib/types";

function hasSuburbFields(listing: ParsedListing) {
  return Boolean(listing.suburb?.trim() && listing.state?.trim());
}

export async function enrichLtrSuburbMarket(
  listing: ParsedListing,
): Promise<{ listing: ParsedListing; warning?: string }> {
  const warnings = [...listing.warnings];

  if (!hasPropRadarConfig()) {
    return { listing: { ...listing, warnings } };
  }

  if (!hasSuburbFields(listing)) {
    return { listing: { ...listing, warnings } };
  }

  try {
    const response = await fetchPropRadarSuburbStats({
      suburb: listing.suburb!,
      state: listing.state!,
      postcode: listing.postcode,
    });

    const ltrSuburbMarket = mapPropRadarSuburbToLtrMarket(
      response,
      listing.propertyType,
    );

    const segmentLabel = ltrSuburbMarket.property_segment === "unit" ? "units" : "houses";
    const warning = `Suburb context from PropRadar (${ltrSuburbMarket.suburb}, ${segmentLabel}).`;

    return {
      listing: {
        ...listing,
        ltrSuburbMarket,
        warnings: [...warnings, warning],
      },
      warning,
    };
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `PropRadar suburb stats skipped: ${error.message}`
        : "PropRadar suburb stats skipped.",
    );
    return { listing: { ...listing, warnings } };
  }
}

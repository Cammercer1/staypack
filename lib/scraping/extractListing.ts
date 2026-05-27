import type { ParsedListing } from "@/lib/types";
import { parseListingFromHtml } from "@/lib/openai/parseListingFromHtml";
import { fetchRenderedHtml } from "@/lib/scraping/fetchRenderedHtml";
import { fetchStaticHtml } from "@/lib/scraping/fetchStaticHtml";
import { mergeParsedListings, parseListing } from "@/lib/scraping/index";

export type ExtractListingResult = {
  listing: ParsedListing;
  method: "static_fetch" | "browserless_rendered";
  parserName: string;
  warnings: string[];
};

export async function extractListingFromUrl(url: string): Promise<ExtractListingResult> {
  const warnings: string[] = [];
  let method: ExtractListingResult["method"] = "browserless_rendered";
  let html = "";

  try {
    const rendered = await fetchRenderedHtml(url);
    if (rendered) {
      html = rendered;
    }
  } catch (error) {
    warnings.push(
      error instanceof Error ? error.message : "Rendered page fetch failed",
    );
  }

  if (!html) {
    method = "static_fetch";

    try {
      html = await fetchStaticHtml(url);
      if (warnings.length) {
        warnings.push(
          "Full page import was unavailable. Used a basic fetch of this page instead.",
        );
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : "Static fetch failed");
    }
  }

  if (!html) {
    throw new Error(
      "Unable to fetch listing HTML. Check the URL and try again, or enter details manually.",
    );
  }

  let ruleParsed = parseListing(html, url);
  let parserName = ruleParsed.parserName;
  let listing = ruleParsed.listing;

  try {
    const aiListing = await parseListingFromHtml({
      html,
      url,
      fallback: ruleParsed.listing,
    });
    listing = mergeParsedListings(ruleParsed.listing, aiListing);
    parserName = "openai";
    if (aiListing.warnings.length) {
      warnings.push(...aiListing.warnings);
    }
  } catch (error) {
    warnings.push(
      error instanceof Error ? error.message : "AI listing parse failed",
    );
    listing = {
      ...ruleParsed.listing,
      warnings: [
        ...ruleParsed.listing.warnings,
          "Automatic extraction failed. Review the prefilled fields carefully.",
      ],
    };
  }

  listing = {
    ...listing,
    warnings: [...new Set([...warnings, ...listing.warnings])],
  };

  if (!listing.title && !listing.description && listing.images.length === 0) {
    listing.warnings.push("Limited listing data extracted. Please review manually.");
  }

  return {
    listing,
    method,
    parserName,
    warnings: listing.warnings,
  };
}

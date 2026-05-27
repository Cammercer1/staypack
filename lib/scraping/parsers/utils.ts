import * as cheerio from "cheerio";
import type { ParsedListing } from "@/lib/types";

export function emptyListing(): ParsedListing {
  return {
    images: [],
    agents: [],
    confidence: "low",
    warnings: [],
  };
}

export function extractNumbers(text: string) {
  const match = text.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : undefined;
}

export function extractMeta($: cheerio.CheerioAPI, property: string) {
  return (
    $(`meta[property="${property}"]`).attr("content") ??
    $(`meta[name="${property}"]`).attr("content")
  );
}

export function uniqueStrings(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

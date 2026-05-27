import type { ParsedListing } from "@/lib/types";

export type ListingParser = {
  /** Stored on scrape_jobs.parser_name when this parser wins scoring */
  name: string;
  parse: (html: string, url: string) => ParsedListing;
};

export type SiteListingParser = ListingParser & {
  /** Hostname patterns (e.g. raywhite.com). First match wins. */
  hosts: RegExp[];
};

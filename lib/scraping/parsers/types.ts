import type { ParsedListing } from "@/lib/types";

export type ListingParser = {
  /** Stored on scrape_jobs.parser_name when this parser wins scoring */
  name: string;
  parse: (html: string, url: string) => ParsedListing;
};

/** Pre-launch readiness for a franchise / portal umbrella (not per office). */
export type ScraperRolloutStatus = "planned" | "in_review" | "verified";

export type SiteListingParser = ListingParser & {
  /** Franchise or portal group, e.g. "Ray White" */
  platform: string;
  /** Hostname patterns (e.g. raywhite.com). First match wins. */
  hosts: RegExp[];
  /**
   * Rollout gate for onboarding agencies on this platform.
   * verified = safe to enable import for agencies on these hosts
   */
  rolloutStatus: ScraperRolloutStatus;
  /** Internal notes (data shape, edge cases, office subdomains, etc.) */
  notes?: string;
  /** Real listing URLs from different offices/regions used during QA */
  qaListingUrls?: string[];
};

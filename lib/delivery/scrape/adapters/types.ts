export type PartnerSourceInput = {
  label?: string;
  url: string;
  adapter?: string;
  config?: Record<string, unknown>;
};

export type DiscoveredListing = {
  listingUrl: string;
  /** How this URL was discovered (stored on scrape runs / debugging). */
  discoveryMethod: string;
};

export type PartnerDiscoveryAdapter = {
  id: string;
  discover(source: PartnerSourceInput): Promise<DiscoveredListing[]>;
};

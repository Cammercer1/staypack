import { discoverListingUrlsFromPartnerPage } from "@/lib/delivery/scrape/discoverListings";
import type {
  DiscoveredListing,
  PartnerDiscoveryAdapter,
  PartnerSourceInput,
} from "@/lib/delivery/scrape/adapters/types";

export const genericLinksAdapter: PartnerDiscoveryAdapter = {
  id: "generic_links",

  async discover(source: PartnerSourceInput): Promise<DiscoveredListing[]> {
    const urls = await discoverListingUrlsFromPartnerPage(source.url);
    return urls.map((listingUrl) => ({
      listingUrl,
      discoveryMethod: "generic_links",
    }));
  },
};

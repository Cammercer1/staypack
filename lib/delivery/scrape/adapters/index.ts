import { genericLinksAdapter } from "@/lib/delivery/scrape/adapters/genericLinks";
import { spfnFirstNationalAdapter } from "@/lib/delivery/scrape/adapters/spfnFirstNational";
import type {
  PartnerDiscoveryAdapter,
  PartnerSourceInput,
  DiscoveredListing,
} from "@/lib/delivery/scrape/adapters/types";

const ADAPTERS: Record<string, PartnerDiscoveryAdapter> = {
  [genericLinksAdapter.id]: genericLinksAdapter,
  [spfnFirstNationalAdapter.id]: spfnFirstNationalAdapter,
};

export function resolvePartnerAdapter(source: PartnerSourceInput): PartnerDiscoveryAdapter {
  const id = source.adapter?.trim() || genericLinksAdapter.id;
  return ADAPTERS[id] ?? genericLinksAdapter;
}

export async function discoverFromPartnerSource(
  source: PartnerSourceInput,
): Promise<DiscoveredListing[]> {
  const adapter = resolvePartnerAdapter(source);
  return adapter.discover(source);
}

export function inferPartnerAdapter(url: string): string | undefined {
  try {
    const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (hostname === "surfersparadisefn.com.au") {
      return spfnFirstNationalAdapter.id;
    }
  } catch {
    // ignore
  }
  return undefined;
}

export { genericLinksAdapter, spfnFirstNationalAdapter };

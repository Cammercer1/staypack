import { fetchSmartScrapeHtml } from "@/lib/browserless/client";

export async function fetchRenderedHtml(url: string): Promise<string | null> {
  return fetchSmartScrapeHtml(url);
}

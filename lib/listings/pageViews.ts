import { createAdminClient } from "@/lib/supabase/admin";

export type ListingPageViewSource = "direct" | "qr";

type PageViewResult =
  | { ok: true; skipped: boolean }
  | { ok: false; error: string };

const BOT_PATTERNS =
  /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|linkedinbot|twitterbot|whatsapp|telegram|preview|lighthouse|headless|puppeteer|playwright/i;

export function isBotUserAgent(userAgent: string) {
  return BOT_PATTERNS.test(userAgent);
}

type RecordPageViewInput = {
  listingId: string;
  source: ListingPageViewSource;
  referrer?: string | null;
  userAgent?: string | null;
};

export async function recordListingPageView({
  listingId,
  source,
  referrer,
  userAgent,
}: RecordPageViewInput): Promise<PageViewResult> {
  if (userAgent && isBotUserAgent(userAgent)) {
    return { ok: true, skipped: true };
  }

  const admin = createAdminClient();

  const { data: listing } = await admin
    .from("listings")
    .select("agency_id")
    .eq("id", listingId)
    .maybeSingle();

  if (!listing) {
    return { ok: false, error: "Listing not found" };
  }

  const { error } = await admin.from("listing_page_views").insert({
    listing_id: listingId,
    agency_id: listing.agency_id,
    referrer: referrer ?? null,
    source,
  });

  if (error) {
    console.error("[pageViews] insert failed", error.message);
    return { ok: false, error: error.message };
  }

  return { ok: true, skipped: false };
}

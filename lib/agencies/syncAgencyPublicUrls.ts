import { getReportsUrl } from "@/lib/env";
import { buildPublicCollateralUrl } from "@/lib/collateral/slugs";
import { buildPublicListingUrl } from "@/lib/listings/listingUrls";
import { buildPublicReportUrl } from "@/lib/reports/slugs";
import type { SupabaseClient } from "@supabase/supabase-js";

function extractAgencySlugFromPublicUrl(publicUrl: string) {
  try {
    const segments = new URL(publicUrl).pathname.split("/").filter(Boolean);
    return segments[0] ?? null;
  } catch {
    return null;
  }
}

/** Slugs still embedded in stored public URLs before a resync. */
export async function discoverStaleAgencySlugsInPublicUrls(
  supabase: SupabaseClient,
  agencyId: string,
  currentSlug: string,
) {
  const stale = new Set<string>();

  const [{ data: listings }, { data: reports }, { data: collateral }] =
    await Promise.all([
      supabase
        .from("listings")
        .select("public_url")
        .eq("agency_id", agencyId)
        .not("public_url", "is", null),
      supabase
        .from("reports")
        .select("public_url")
        .eq("agency_id", agencyId)
        .not("public_url", "is", null),
      supabase
        .from("collateral_items")
        .select("public_url")
        .eq("agency_id", agencyId)
        .not("public_url", "is", null),
    ]);

  for (const row of [...(listings ?? []), ...(reports ?? []), ...(collateral ?? [])]) {
    if (!row.public_url) continue;

    const slug = extractAgencySlugFromPublicUrl(row.public_url);
    if (slug && slug !== currentSlug) {
      stale.add(slug);
    }
  }

  return [...stale];
}

/** Rebuild stored public URLs after the agency report link name (slug) changes. */
export async function syncAgencyPublicUrls(
  supabase: SupabaseClient,
  agencyId: string,
  agencySlug: string,
) {
  const reportsBaseUrl = getReportsUrl();

  const { data: listings, error: listingsError } = await supabase
    .from("listings")
    .select("id, public_slug")
    .eq("agency_id", agencyId)
    .not("public_slug", "is", null);

  if (listingsError) {
    throw new Error(listingsError.message);
  }

  for (const listing of listings ?? []) {
    if (!listing.public_slug) continue;

    const { error } = await supabase
      .from("listings")
      .update({
        public_url: buildPublicListingUrl(agencySlug, listing.public_slug),
      })
      .eq("id", listing.id);

    if (error) {
      throw new Error(error.message);
    }
  }

  const { data: reports, error: reportsError } = await supabase
    .from("reports")
    .select("id, public_slug")
    .eq("agency_id", agencyId)
    .not("public_slug", "is", null);

  if (reportsError) {
    throw new Error(reportsError.message);
  }

  for (const report of reports ?? []) {
    if (!report.public_slug) continue;

    const { error } = await supabase
      .from("reports")
      .update({
        public_url: buildPublicReportUrl(
          reportsBaseUrl,
          agencySlug,
          report.public_slug,
        ),
      })
      .eq("id", report.id);

    if (error) {
      throw new Error(error.message);
    }
  }

  const { data: collateralItems, error: collateralError } = await supabase
    .from("collateral_items")
    .select("id, public_slug")
    .eq("agency_id", agencyId)
    .not("public_slug", "is", null);

  if (collateralError) {
    throw new Error(collateralError.message);
  }

  for (const item of collateralItems ?? []) {
    if (!item.public_slug) continue;

    const { error } = await supabase
      .from("collateral_items")
      .update({
        public_url: buildPublicCollateralUrl(agencySlug, item.public_slug),
      })
      .eq("id", item.id);

    if (error) {
      throw new Error(error.message);
    }
  }
}

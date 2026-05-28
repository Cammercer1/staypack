import { notFound } from "next/navigation";
import { Bath, BedDouble, Car } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/env";
import {
  buildBrandGoogleFontsUrl,
  resolveBodyFontFamily,
  resolveHeadingFontFamily,
} from "@/lib/branding/google-fonts";
import { marked } from "marked";
import { getGoogleMapsApiKey } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { ListingLeadForm } from "@/components/listings/ListingLeadForm";
import { ListingImageGallery } from "@/components/listings/ListingImageGallery";
import { InlineDescriptionEditor } from "@/components/listings/InlineDescriptionEditor";
import { resolveCollateralGalleryUrls } from "@/lib/listings/collateralImages";
import { ListingViewTracker } from "@/components/listings/ListingViewTracker";
import { StayPackLogo } from "@/components/app-shell/StayPackLogo";
import type { Agency, Listing } from "@/lib/types";

export default async function PublicListingLandingPage({
  params,
}: {
  params: Promise<{ agencySlug: string; listingSlug: string }>;
}) {
  const { agencySlug, listingSlug } = await params;

  if (!hasServiceRoleKey()) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-muted-foreground">
          Configure Supabase service role credentials to view listing landing pages.
        </p>
      </div>
    );
  }

  const admin = createAdminClient();
  const { data: agency } = await admin
    .from("agencies")
    .select("*")
    .eq("slug", agencySlug)
    .maybeSingle();

  if (!agency) notFound();

  const { data: listing } = await admin
    .from("listings")
    .select("*")
    .eq("agency_id", agency.id)
    .eq("public_slug", listingSlug)
    .eq("status", "active")
    .maybeSingle();

  if (!listing) notFound();

  const a = agency as Agency;
  const l = listing as Listing;

  const primaryColour = a.primary_colour ?? "#002e36";
  const bgColour = a.background_colour ?? "#f9f5ea";
  const textColour = a.text_colour ?? "#002e36";

  // Fonts
  const headingFontId = a.heading_font_family || a.font_family || "fraunces";
  const bodyFontId = a.body_font_family || a.font_family || "inter";
  const headingFontFileUrl = a.heading_font_file_url ?? null;
  const bodyFontFileUrl = a.body_font_file_url ?? a.font_file_url ?? null;

  const headingFontFamily = resolveHeadingFontFamily(headingFontId, headingFontFileUrl);
  const bodyFontFamily = resolveBodyFontFamily(bodyFontId, bodyFontFileUrl);
  const googleFontsUrl = buildBrandGoogleFontsUrl(
    headingFontId,
    bodyFontId,
    headingFontFileUrl,
    bodyFontFileUrl,
  );

  const allImages = resolveCollateralGalleryUrls(l, "landing");

  const suburb = [l.suburb, l.state, l.postcode].filter(Boolean).join(", ");

  // Check if the current user owns this listing (for inline editing)
  let isOwner = false;
  try {
    const userClient = await createClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (user) {
      const { data: member } = await userClient
        .from("agency_members")
        .select("id")
        .eq("agency_id", a.id)
        .eq("user_id", user.id)
        .maybeSingle();
      isOwner = Boolean(member);
    }
  } catch {
    // Not logged in — no inline editing
  }

  const mapsApiKey = getGoogleMapsApiKey();
  const fullAddressForMap = [
    l.property_address,
    l.suburb,
    l.state,
    l.postcode,
    "Australia",
  ]
    .filter(Boolean)
    .join(", ");
  const mapSrc = mapsApiKey
    ? `https://www.google.com/maps/embed/v1/place?key=${mapsApiKey}&q=${encodeURIComponent(fullAddressForMap)}&zoom=15`
    : l.latitude != null && l.longitude != null
      ? `https://maps.google.com/maps?q=${l.latitude},${l.longitude}&z=15&output=embed`
      : `https://maps.google.com/maps?q=${encodeURIComponent(fullAddressForMap)}&z=15&output=embed`;

  return (
    <div
      className="min-h-screen scroll-smooth"
      style={{
        backgroundColor: bgColour,
        color: textColour,
        fontFamily: bodyFontFamily,
      }}
    >
      {/* ── View tracker (skipped for logged-in owners) ─────────── */}
      {!isOwner ? <ListingViewTracker listingId={l.id} /> : null}

      {/* ── Brand fonts ─────────────────────────────────────────── */}
      {headingFontFileUrl ? (
        <style>{`@font-face { font-family: "AgencyHeadingFont"; src: url("${headingFontFileUrl}"); }`}</style>
      ) : null}
      {bodyFontFileUrl ? (
        <style>{`@font-face { font-family: "AgencyBodyFont"; src: url("${bodyFontFileUrl}"); }`}</style>
      ) : null}
      {googleFontsUrl ? (
        <link rel="stylesheet" href={googleFontsUrl} />
      ) : null}
      {/* font-display override so heading elements pick up the brand heading font */}
      <style>{`
        h1, h2, h3 { font-family: ${headingFontFamily}; }
      `}</style>

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white shadow-sm">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-4">
          {a.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.logo_url} alt={a.name} className="h-8 w-auto object-contain" />
          ) : (
            <StayPackLogo href={undefined} height={24} />
          )}
          <a
            href="#lead-form"
            className="px-5 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: primaryColour }}
          >
            Express interest
          </a>
        </div>
      </header>

      {/* ── Gallery ─────────────────────────────────────────────── */}
      <div className="mx-auto max-w-[1280px] pt-8">
        <ListingImageGallery
          images={allImages}
          address={l.property_address ?? "Property"}
        />
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <main className="mx-auto max-w-[1280px] px-6 py-10">
        <div className="grid gap-12 md:grid-cols-[1fr_340px] md:items-start">

          {/* Left — property details + description */}
          <div className="space-y-8">

            {/* Address + price */}
            <div>
              <h1
                className="font-display text-3xl font-bold leading-tight tracking-tight"
                style={{ color: primaryColour }}
              >
                {l.listing_title ?? l.property_address ?? "Property"}
              </h1>
              {l.display_price ? (
                <p className="mt-2 text-3xl font-bold" style={{ color: primaryColour }}>
                  {l.display_price}
                </p>
              ) : null}
              {suburb ? (
                <p className="mt-1.5 text-sm opacity-60">{suburb}</p>
              ) : null}
            </div>

            {/* Beds / bath / car */}
            {(l.bedrooms != null || l.bathrooms != null || l.car_spaces != null) ? (
              <div className="flex flex-wrap items-center gap-6 border-y border-black/8 py-5">
                {l.bedrooms != null ? (
                  <span className="flex items-center gap-2">
                    <BedDouble className="h-5 w-5 opacity-40" />
                    <span className="font-semibold">{l.bedrooms}</span>
                    <span className="text-sm opacity-60">bed</span>
                  </span>
                ) : null}
                {l.bathrooms != null ? (
                  <span className="flex items-center gap-2">
                    <Bath className="h-5 w-5 opacity-40" />
                    <span className="font-semibold">{l.bathrooms}</span>
                    <span className="text-sm opacity-60">bath</span>
                  </span>
                ) : null}
                {l.car_spaces != null ? (
                  <span className="flex items-center gap-2">
                    <Car className="h-5 w-5 opacity-40" />
                    <span className="font-semibold">{l.car_spaces}</span>
                    <span className="text-sm opacity-60">car</span>
                  </span>
                ) : null}
              </div>
            ) : null}

            {/* Description */}
            {isOwner ? (
              <InlineDescriptionEditor
                listingId={l.id}
                initialDescription={l.listing_description ?? ""}
                primaryColour={primaryColour}
              />
            ) : l.listing_description ? (
              <div
                className="prose prose-sm max-w-none opacity-75
                  prose-headings:font-semibold prose-headings:text-inherit prose-headings:mt-6 prose-headings:mb-2
                  prose-h2:text-base prose-h3:text-sm
                  prose-p:leading-7 prose-p:text-inherit"
                dangerouslySetInnerHTML={{
                  // Stored value may already be HTML (from WYSIWYG editor) or
                  // legacy markdown — parse only when it doesn't look like HTML
                  __html: l.listing_description.startsWith("<")
                    ? l.listing_description
                    : (marked.parse(l.listing_description) as string),
                }}
              />
            ) : null}

            {/* Map */}
            <div className="overflow-hidden">
                <iframe
                  src={mapSrc}
                  width="100%"
                  height="340"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title={`Map of ${l.property_address ?? "property"}`}
                />
            </div>
          </div>

          {/* Right — agents + lead form, sticky */}
          <div id="lead-form" className="space-y-4 md:sticky md:top-20">
            {/* Agent cards */}
            {(l.scraped_listing_json?.agents ?? []).filter((ag) => ag.name).map((ag, i) => (
              <div key={i} className="flex items-center gap-3">
                {ag.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ag.photo_url}
                    alt={ag.name ?? "Agent"}
                    className="h-14 w-14 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
                    style={{ backgroundColor: primaryColour }}
                  >
                    {ag.name?.charAt(0) ?? "?"}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-semibold leading-tight">{ag.name}</p>
                  {ag.role_title ? (
                    <p className="text-sm opacity-60">{ag.role_title}</p>
                  ) : null}
                  {ag.phone ? (
                    <a
                      href={`tel:${ag.phone}`}
                      className="mt-0.5 block text-sm font-medium"
                      style={{ color: primaryColour }}
                    >
                      {ag.phone}
                    </a>
                  ) : null}
                </div>
              </div>
            ))}

            <ListingLeadForm
              agencySlug={agencySlug}
              listingSlug={listingSlug}
              primaryColour={primaryColour}
            />
          </div>
        </div>
      </main>
      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="mt-16 border-t border-black/5 bg-white">
        <div className="mx-auto flex max-w-[1280px] items-center px-6 py-6">
          {a.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.logo_url} alt={a.name} className="h-7 w-auto object-contain opacity-70" />
          ) : (
            <StayPackLogo href={undefined} height={20} />
          )}
        </div>
      </footer>
    </div>
  );
}

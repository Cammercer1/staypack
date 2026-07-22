import { notFound, redirect } from "next/navigation";
import {
  agencySlugNeedsRedirect,
  resolveAgencyBySlug,
} from "@/lib/agencies/resolveAgencyBySlug";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/env";
import {
  buildBrandGoogleFontsUrl,
  resolveBodyFontFamily,
  resolveHeadingFontFamily,
} from "@/lib/branding/google-fonts";
import { getGoogleMapsApiKey } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import {
  getBrandAdvancedCssVars,
  resolveBrandAdvanced,
} from "@/lib/branding/advanced";
import { resolveAgencyLogos } from "@/lib/branding/logos";
import { resolveCollateralGalleryUrls } from "@/lib/listings/collateralImages";
import { ListingViewTracker } from "@/components/listings/ListingViewTracker";
import { LandingTemplatePreviewBar } from "@/components/listings/LandingTemplatePreviewBar";
import { ClassicLandingTemplate } from "@/lib/listings/templates/classic/ClassicLandingTemplate";
import { MinimalLandingTemplate } from "@/lib/listings/templates/minimal/MinimalLandingTemplate";
import { resolveLandingTemplate, type LandingTemplateId } from "@/lib/listings/templates/registry";
import type { Agency, Listing } from "@/lib/types";

export default async function PublicListingLandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ agencySlug: string; listingSlug: string }>;
  searchParams: Promise<{ preview?: string; template?: string; embed?: string }>;
}) {
  const { agencySlug, listingSlug } = await params;
  const { preview, template: templateParam, embed } = await searchParams;
  const isPreview = preview === "1";
  // When embedded in the workspace preview modal, the modal supplies the
  // template controls — suppress the in-page floating bar.
  const isEmbedded = embed === "1";

  if (!hasServiceRoleKey()) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <p className="text-muted-foreground">
          Configure Supabase service role credentials to view property pages.
        </p>
      </div>
    );
  }

  const admin = createAdminClient();
  const agency = await resolveAgencyBySlug(admin, agencySlug);

  if (!agency) notFound();

  if (agencySlugNeedsRedirect(agency, agencySlug)) {
    redirect(`/${agency.slug}/l/${listingSlug}`);
  }

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

  // ── Resolve which template to render ─────────────────────────
  const savedTemplateId = resolveLandingTemplate(l.landing_template);
  const activeTemplateId: LandingTemplateId = isPreview
    ? resolveLandingTemplate(templateParam)
    : savedTemplateId;

  // ── Brand ────────────────────────────────────────────────────
  const primaryColour = a.primary_colour ?? "#002e36";
  const bgColour = a.background_colour ?? "#f9f5ea";
  const textColour = a.text_colour ?? "#002e36";
  const brandAdvanced = resolveBrandAdvanced(a);
  const brandCssVars = getBrandAdvancedCssVars(brandAdvanced);
  const logos = resolveAgencyLogos(a);

  // ── Fonts ────────────────────────────────────────────────────
  const headingFontId = a.heading_font_family || a.font_family || "fraunces";
  const bodyFontId = a.body_font_family || a.font_family || "inter";
  const headingFontFileUrl = a.heading_font_file_url ?? null;
  const bodyFontFileUrl = a.body_font_file_url ?? a.font_file_url ?? null;
  const headingFontFamily = resolveHeadingFontFamily(headingFontId, headingFontFileUrl);
  const bodyFontFamily = resolveBodyFontFamily(bodyFontId, bodyFontFileUrl);
  const googleFontsUrl = buildBrandGoogleFontsUrl(
    headingFontId, bodyFontId, headingFontFileUrl, bodyFontFileUrl,
  );
  const headingFontFaceCSS = headingFontFileUrl
    ? `@font-face { font-family: "AgencyHeadingFont"; src: url("${headingFontFileUrl}"); }`
    : null;
  const bodyFontFaceCSS = bodyFontFileUrl
    ? `@font-face { font-family: "AgencyBodyFont"; src: url("${bodyFontFileUrl}"); }`
    : null;

  // ── Images + location ────────────────────────────────────────
  const allImages = resolveCollateralGalleryUrls(l, "landing");
  const suburb = [l.suburb, l.state, l.postcode].filter(Boolean).join(", ");

  // ── Owner check ──────────────────────────────────────────────
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
  } catch { /* not logged in */ }

  // ── Map ──────────────────────────────────────────────────────
  const mapsApiKey = getGoogleMapsApiKey();
  const fullAddressForMap = [l.property_address, l.suburb, l.state, l.postcode, "Australia"]
    .filter(Boolean).join(", ");
  const mapSrc = mapsApiKey
    ? `https://www.google.com/maps/embed/v1/place?key=${mapsApiKey}&q=${encodeURIComponent(fullAddressForMap)}&zoom=15`
    : l.latitude != null && l.longitude != null
      ? `https://maps.google.com/maps?q=${l.latitude},${l.longitude}&z=15&output=embed`
      : `https://maps.google.com/maps?q=${encodeURIComponent(fullAddressForMap)}&z=15&output=embed`;

  const templateProps = {
    listing: l,
    agency: a,
    agencySlug,
    listingSlug,
    brandAdvanced,
    logos,
    allImages,
    suburb,
    headingFontFamily,
    bodyFontFamily,
    googleFontsUrl,
    headingFontFaceCSS,
    bodyFontFaceCSS,
    primaryColour,
    bgColour,
    textColour,
    brandCssVars,
    isOwner,
    mapSrc,
  };

  return (
    <>
      {!isOwner && !isPreview ? <ListingViewTracker listingId={l.id} /> : null}

      {activeTemplateId === "classic" ? (
        <ClassicLandingTemplate {...templateProps} />
      ) : (
        <MinimalLandingTemplate {...templateProps} />
      )}

      {isPreview && !isEmbedded ? (
        <LandingTemplatePreviewBar
          listingId={l.id}
          agencySlug={agencySlug}
          listingSlug={listingSlug}
          activeTemplateId={activeTemplateId}
          savedTemplateId={savedTemplateId}
        />
      ) : null}
    </>
  );
}

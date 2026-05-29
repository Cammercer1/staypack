import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/env";
import { resolveCollateralGalleryUrls } from "@/lib/listings/collateralImages";
import { resolveBrandAdvanced } from "@/lib/branding/advanced";
import { resolveAgencyLogos } from "@/lib/branding/logos";
import {
  buildBrandGoogleFontsUrl,
  resolveHeadingFontFamily,
  resolveBodyFontFamily,
} from "@/lib/branding/google-fonts";
import type { Agency, Listing } from "@/lib/types";
import { ListingHeroPrototype } from "./ListingHeroPrototype";

const DEFAULT_LISTING_ID = "cf89375e-7095-4721-9c3a-66036af20be3";

export default async function DevListingHeroPage({
  searchParams,
}: {
  searchParams: Promise<{ listingId?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  if (!hasServiceRoleKey()) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
        Configure Supabase service role credentials to use this page.
      </div>
    );
  }

  const { listingId = DEFAULT_LISTING_ID } = await searchParams;
  const admin = createAdminClient();

  const { data: listing } = await admin
    .from("listings")
    .select("*, agency:agencies(*)")
    .eq("id", listingId)
    .maybeSingle();

  if (!listing) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
        Listing <code className="mx-1 font-mono">{listingId}</code> not found.
      </div>
    );
  }

  const l = listing as Listing & { agency: Agency };
  const a = l.agency;
  const brand = resolveBrandAdvanced(a);
  const logos = resolveAgencyLogos(a);
  const images = resolveCollateralGalleryUrls(l, "landing");
  const suburb = [l.suburb, l.state, l.postcode].filter(Boolean).join(", ");

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

  return (
    <ListingHeroPrototype
      // Property
      address={l.listing_title ?? l.property_address ?? "Property"}
      suburb={suburb}
      price={l.display_price ?? null}
      beds={l.bedrooms ?? null}
      baths={l.bathrooms ?? null}
      cars={l.car_spaces ?? null}
      heroImage={images[0] ?? null}
      // Agency
      agencyName={a.name}
      logoOnDark={logos.onDark || logos.onLight}
      primaryColour={a.primary_colour ?? "#002e36"}
      // Fonts
      googleFontsUrl={googleFontsUrl}
      headingFontFamily={headingFontFamily}
      bodyFontFamily={bodyFontFamily}
      headingFontFaceCSS={
        headingFontFileUrl
          ? `@font-face { font-family: "AgencyHeadingFont"; src: url("${headingFontFileUrl}"); }`
          : null
      }
      bodyFontFaceCSS={
        bodyFontFileUrl
          ? `@font-face { font-family: "AgencyBodyFont"; src: url("${bodyFontFileUrl}"); }`
          : null
      }
      // Brand card
      cardBackgroundColour={brand.cardBackgroundColour}
      cardBorderColour={brand.cardBorderColour}
      cardBorderRadiusPx={brand.cardBorderRadiusPx}
      cardBorderWidthPx={brand.cardBorderWidthPx}
      cardShadow={brand.cardShadow}
      // Brand button
      buttonBackground={brand.buttonBackground}
      buttonText={brand.buttonText}
      buttonBorderRadiusPx={brand.buttonBorderRadiusPx}
      buttonBorderWidthPx={brand.buttonBorderWidthPx}
      buttonBorderColour={brand.buttonBorderColour}
      // Brand inputs + links
      inputBorderRadiusPx={brand.inputBorderRadiusPx}
      linkColour={brand.linkColour}
    />
  );
}

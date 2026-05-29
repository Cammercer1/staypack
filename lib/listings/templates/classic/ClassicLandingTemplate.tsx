import { Bath, BedDouble, Car } from "lucide-react";
import { marked } from "marked";
import { ListingLeadForm } from "@/components/listings/ListingLeadForm";
import { ListingImageGallery } from "@/components/listings/ListingImageGallery";
import { InlineDescriptionEditor } from "@/components/listings/InlineDescriptionEditor";
import { StayPackLogo } from "@/components/app-shell/StayPackLogo";
import { getBrandButtonInlineStyle } from "@/lib/branding/advanced";
import type { LandingTemplateProps } from "@/lib/listings/templates/types";

export function ClassicLandingTemplate({
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
}: LandingTemplateProps) {
  return (
    <div
      className="min-h-screen scroll-smooth"
      style={{
        backgroundColor: bgColour,
        color: textColour,
        fontFamily: bodyFontFamily,
        ...brandCssVars,
      }}
    >
      {/* ── Brand fonts ─────────────────────────────────────────── */}
      {headingFontFaceCSS ? <style>{headingFontFaceCSS}</style> : null}
      {bodyFontFaceCSS ? <style>{bodyFontFaceCSS}</style> : null}
      {googleFontsUrl ? <link rel="stylesheet" href={googleFontsUrl} /> : null}
      <style>{`h1, h2, h3 { font-family: ${headingFontFamily}; }`}</style>

      {/* ── Header ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white shadow-sm">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-3 md:py-4">
          {logos.onLight ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logos.onLight} alt={a.name} className="h-7 w-auto object-contain md:h-8" />
          ) : (
            <StayPackLogo href={undefined} height={24} />
          )}
          <a
            href="#lead-form"
            className="px-4 py-1.5 text-xs font-semibold shadow-sm transition-opacity hover:opacity-90 md:px-5 md:py-2 md:text-sm"
            style={getBrandButtonInlineStyle(brandAdvanced)}
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
      <main className="mx-auto max-w-[1280px] px-6 py-8 md:py-10">
        <div className="grid gap-8 md:grid-cols-[1fr_340px] md:items-start md:gap-12">

          {/* Left — property details + description */}
          <div className="space-y-6 md:space-y-8">
            {/* Address + price */}
            <div>
              <h1
                className="font-display text-xl font-semibold leading-snug tracking-tight md:text-3xl md:font-bold md:leading-tight"
                style={{ color: primaryColour }}
              >
                {l.listing_title ?? l.property_address ?? "Property"}
              </h1>
              {l.display_price ? (
                <p
                  className="mt-1.5 text-lg font-semibold md:mt-2 md:text-3xl md:font-bold"
                  style={{ color: primaryColour }}
                >
                  {l.display_price}
                </p>
              ) : null}
              {suburb ? (
                <p className="mt-1 text-sm opacity-60 md:mt-1.5">{suburb}</p>
              ) : null}
            </div>

            {/* Beds / bath / car */}
            {(l.bedrooms != null || l.bathrooms != null || l.car_spaces != null) ? (
              <div className="flex flex-wrap items-center gap-4 border-y border-black/8 py-4 md:gap-6 md:py-5">
                {l.bedrooms != null ? (
                  <span className="flex items-center gap-2">
                    <BedDouble className="h-4 w-4 opacity-40 md:h-5 md:w-5" />
                    <span className="font-semibold">{l.bedrooms}</span>
                    <span className="text-sm opacity-60">bed</span>
                  </span>
                ) : null}
                {l.bathrooms != null ? (
                  <span className="flex items-center gap-2">
                    <Bath className="h-4 w-4 opacity-40 md:h-5 md:w-5" />
                    <span className="font-semibold">{l.bathrooms}</span>
                    <span className="text-sm opacity-60">bath</span>
                  </span>
                ) : null}
                {l.car_spaces != null ? (
                  <span className="flex items-center gap-2">
                    <Car className="h-4 w-4 opacity-40 md:h-5 md:w-5" />
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
              brandAdvanced={brandAdvanced}
            />
          </div>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="mt-16 border-t border-black/5 bg-white">
        <div className="mx-auto flex max-w-[1280px] items-center px-6 py-6">
          {logos.onLight ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logos.onLight} alt={a.name} className="h-7 w-auto object-contain opacity-70" />
          ) : (
            <StayPackLogo href={undefined} height={20} />
          )}
        </div>
      </footer>
    </div>
  );
}

"use client";

import { BrandFontLoader, useBrandFontStyles } from "@/components/settings/BrandFontLoader";
import {
  getBrandButtonInlineStyle,
  resolveBrandAdvanced,
} from "@/lib/branding/advanced";
import { resolveAgencyLogos } from "@/lib/branding/logos";
import type { AgencyInput } from "@/lib/validation/schemas";

export function BrandPreviewCard({ preview }: { preview: AgencyInput }) {
  const fonts = {
    heading_font_family: preview.heading_font_family || "fraunces",
    body_font_family: preview.body_font_family || preview.font_family || "inter",
    heading_font_file_url: preview.heading_font_file_url,
    body_font_file_url: preview.body_font_file_url || preview.font_file_url,
  };
  const { headingFamily, bodyFamily } = useBrandFontStyles(fonts);
  const brandAdvanced = resolveBrandAdvanced({
    primary_colour: preview.primary_colour || "#002e36",
    text_colour: preview.text_colour || "#002e36",
    brand_advanced_json: preview.brand_advanced_json ?? null,
  });
  const logos = resolveAgencyLogos(preview);

  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 shadow-sm">
      <BrandFontLoader fonts={fonts} />

      <div
        className="p-6"
        style={{
          backgroundColor: preview.background_colour || "#f9f5ea",
          color: preview.text_colour || "#002e36",
          fontFamily: bodyFamily,
          ...({
            "--brand-logo-on-light": logos.onLight,
            "--brand-logo-on-dark": logos.onDark,
          } as React.CSSProperties),
        }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-black/10 pb-4">
          <div>
            {logos.onLight ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logos.onLight} alt="" className="mb-3 h-10 object-contain" />
            ) : null}
            <p
              className="text-xl font-semibold"
              style={{ fontFamily: headingFamily }}
            >
              {preview.default_report_title || "Short-Term Rental Potential Report"}
            </p>
            <p className="mt-1 text-sm opacity-75">
              {preview.name || "Your Agency Name"}
            </p>
          </div>
          <div
            className="rounded-full px-3 py-1 text-xs font-medium text-white"
            style={{ backgroundColor: preview.primary_colour || "#002e36" }}
          >
            Preview
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div
            className="rounded-2xl p-4 text-white"
            style={{ backgroundColor: preview.primary_colour || "#002e36" }}
          >
            {logos.onDark ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logos.onDark} alt="" className="mb-3 h-8 object-contain" />
            ) : null}
            <p
              className="text-xs uppercase tracking-wide opacity-80"
              style={{ fontFamily: headingFamily }}
            >
              Estimated gross STR revenue
            </p>
            <p className="mt-2 text-3xl font-semibold" style={{ fontFamily: headingFamily }}>
              $72,000
            </p>
          </div>
          <div
            className="rounded-2xl p-4"
            style={{
              backgroundColor: preview.accent_colour || "#e8efe3",
              color: preview.callout_text_colour || preview.text_colour || "#333333",
            }}
          >
            <p className="text-sm font-medium">Buyer note</p>
            <p className="mt-2 text-sm leading-6 opacity-80">
              {preview.default_cta ||
                "Speak with the agent for the full buyer pack and property details."}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="mt-5 px-5 py-2.5 text-sm font-semibold shadow-sm"
          style={getBrandButtonInlineStyle(brandAdvanced)}
        >
          Sample button style
        </button>
      </div>
    </div>
  );
}

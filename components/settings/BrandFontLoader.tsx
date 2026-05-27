"use client";

import {
  buildBrandGoogleFontsUrl,
  getFontDisplayName,
  resolveBodyFontFamily,
  resolveHeadingFontFamily,
} from "@/lib/branding/google-fonts";

type BrandFonts = {
  heading_font_family: string;
  body_font_family: string;
  heading_font_file_url?: string | null;
  body_font_file_url?: string | null;
};

export function BrandFontLoader({ fonts }: { fonts: BrandFonts }) {
  const googleFontsUrl = buildBrandGoogleFontsUrl(
    fonts.heading_font_family,
    fonts.body_font_family,
    fonts.heading_font_file_url,
    fonts.body_font_file_url,
  );

  return (
    <>
      {fonts.heading_font_file_url ? (
        <style>{`
          @font-face {
            font-family: "AgencyHeadingFont";
            src: url("${fonts.heading_font_file_url}");
          }
        `}</style>
      ) : null}
      {fonts.body_font_file_url ? (
        <style>{`
          @font-face {
            font-family: "AgencyBodyFont";
            src: url("${fonts.body_font_file_url}");
          }
        `}</style>
      ) : null}
      {googleFontsUrl ? <link rel="stylesheet" href={googleFontsUrl} /> : null}
    </>
  );
}

export function useBrandFontStyles(fonts: BrandFonts) {
  return {
    headingFamily: resolveHeadingFontFamily(
      fonts.heading_font_family,
      fonts.heading_font_file_url,
    ),
    bodyFamily: resolveBodyFontFamily(
      fonts.body_font_family,
      fonts.body_font_file_url,
    ),
    headingLabel: getFontDisplayName(fonts.heading_font_family),
    bodyLabel: getFontDisplayName(fonts.body_font_family),
  };
}

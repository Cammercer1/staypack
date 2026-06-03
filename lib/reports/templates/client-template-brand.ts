/**
 * Pattern for bespoke managed-delivery / white-label STR templates.
 *
 * Each client gets a folder under lib/reports/templates/{client-slug}/ with:
 * - brand.ts — hardcoded colours, logo URLs, fonts (no StayPacks Settings UI)
 * - {Client}StrTemplate.tsx — layout; calls applyXBrandToReport() before render
 * - public/delivery/{client-slug}/ — static logo assets (SVG/PNG)
 *
 * Listing data (photos, STR estimate, copy) still comes from the report payload.
 * Agency rows in the DB are only for FK/storage — not for visual branding.
 */

export type ClientTemplateBrand = {
  name: string;
  logoOnDarkUrl: string;
  logoOnLightUrl: string;
  primaryColour: string;
  accentColour: string;
  backgroundColour: string;
  textColour: string;
};

import type { Agency, Listing } from "@/lib/types";
import type { ResolvedBrandAdvanced } from "@/lib/branding/advanced";
import type { ResolvedAgencyLogos } from "@/lib/branding/logos";

export type LandingTemplateProps = {
  listing: Listing;
  agency: Agency;
  agencySlug: string;
  listingSlug: string;
  brandAdvanced: ResolvedBrandAdvanced;
  logos: ResolvedAgencyLogos;
  // Pre-resolved images
  allImages: string[];
  suburb: string;
  // Pre-resolved fonts
  headingFontFamily: string;
  bodyFontFamily: string;
  googleFontsUrl: string | null;
  headingFontFaceCSS: string | null;
  bodyFontFaceCSS: string | null;
  // Pre-resolved brand colours
  primaryColour: string;
  bgColour: string;
  textColour: string;
  brandCssVars: Record<string, string>;
  // Page state
  isOwner: boolean;
  mapSrc: string;
};

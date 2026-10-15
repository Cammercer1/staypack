import { buildGoogleFontStylesheetUrl } from "@/lib/branding/google-fonts";
import type { ProposalBrand } from "./brand";

export function usesManrope(brand: ProposalBrand) {
  return [brand.headingFont, brand.bodyFont].some(family => family.split(",")[0].replace(/["']/g, "").trim().toLowerCase() === "manrope");
}

export function usesMontserrat(brand: ProposalBrand) {
  return [brand.headingFont, brand.bodyFont].some(family => family.split(",")[0].replace(/["']/g, "").trim().toLowerCase() === "montserrat");
}

export function usesRoboto(brand: ProposalBrand) {
  return [brand.headingFont, brand.bodyFont].some(family => family.split(",")[0].replace(/["']/g, "").trim().toLowerCase() === "roboto");
}

/** Browserless receives standalone HTML, so font URLs there must be absolute. */
export function proposalPrintFontUrl(brand: ProposalBrand) {
  const configured = [brand.headingFont, brand.bodyFont].map(family => family.split(",")[0].replace(/["']/g, "").trim().toLowerCase());
  const families = ["Manrope", "Montserrat", "Roboto", "Inter", "Fraunces", "DM Sans"].filter(family => configured.includes(family.toLowerCase()));
  return families.length ? buildGoogleFontStylesheetUrl(families) : null;
}

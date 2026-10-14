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
  const families = [usesManrope(brand) ? "Manrope" : null, usesMontserrat(brand) ? "Montserrat" : null, usesRoboto(brand) ? "Roboto" : null].filter((family): family is string => family !== null);
  return families.length ? buildGoogleFontStylesheetUrl(families) : null;
}

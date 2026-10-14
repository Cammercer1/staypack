import type { Agency } from "@/lib/types";
import { countryName } from "./index";
import { isZillowUrl } from "@/lib/us-property/url";

export class AgencyCountryError extends Error {}
export const SUPPORTED_COUNTRIES = ["AU", "US"] as const;
export type AgencyCountry = (typeof SUPPORTED_COUNTRIES)[number];
const AU_STATES = new Set(["NSW", "VIC", "QLD", "WA", "SA", "TAS", "ACT", "NT"]);
const US_STATES = new Set("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY AS GU MP PR VI".split(" "));
export function countryCode(value: string | null | undefined): AgencyCountry | null {
  const normalized = value?.trim().toUpperCase();
  if (["AU", "AUSTRALIA"].includes(normalized ?? "")) return "AU";
  if (["US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA"].includes(normalized ?? "")) return "US";
  return null;
}
export function agencyCountry(agency: Pick<Agency, "country_code">): AgencyCountry {
  const country = countryCode(agency.country_code ?? "AU");
  if (!country) throw new AgencyCountryError("Your agency country is not supported. Update Agency details before searching.");
  return country;
}
export function assertRequestedCountry(agency: Pick<Agency, "country_code">, requested?: string | null) {
  const country = agencyCountry(agency);
  if (requested != null && countryCode(requested) !== country) throw new AgencyCountryError(`Your agency is set to ${countryName(country)}. Search for properties in ${countryName(country)} only.`);
  return country;
}
export function assertPropertyCountry(agency: Pick<Agency, "country_code">, property: { country?: string | null; state?: string | null; postcode?: string | null }) {
  const country = assertRequestedCountry(agency, property.country ?? "AU");
  if (property.state?.trim() && !(country === "AU" ? AU_STATES : US_STATES).has(property.state.trim().toUpperCase())) throw new AgencyCountryError(`Choose a state in ${countryName(country)}.`);
  if (property.postcode?.trim() && !(country === "AU" ? /^\d{4}$/ : /^\d{5}(?:-\d{4})?$/).test(property.postcode.trim())) throw new AgencyCountryError(country === "AU" ? "Enter a four-digit Australian postcode." : "Enter a five-digit US ZIP code (optional +4).");
  return country;
}
export function assertListingUrlCountry(country: AgencyCountry, value: string) {
  const url = new URL(value);
  if (country === "US" && !isZillowUrl(value)) throw new AgencyCountryError("For a US agency, paste a Zillow home link or search for a US address.");
  if (country === "AU" && (isZillowUrl(value) || /(?:\.nz|\.co\.uk|\.ca)$/.test(url.hostname))) throw new AgencyCountryError("For an Australian agency, use an Australian listing or search for an Australian address.");
}

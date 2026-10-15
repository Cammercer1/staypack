import { propertyIdentity } from "@/lib/listings/propertyIdentity";
import { marketForCountry } from "@/lib/property-market";
import type { Listing } from "@/lib/types";

const normalizeFullAddress = (value: string) => value.toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ").trim();
const normalize = (value: string) => normalizeFullAddress(value).replace(/\./g, "");
const countries = { AU: /^(?:Australia|AU)$/i, US: /^(?:USA|US|United States(?: of America)?)$/i };
const usUnitSegment = /^(?:apartment|apt\.?|unit|suite|ste\.?|#)\s*#?\s*(?:(?:penthouse|ph)\s+)?[a-z0-9]+(?:-[a-z0-9]+)?$/i;

/** The display-address parser intentionally accepts loose inputs. A review key
 * must also retain any segments it cannot safely identify, especially a unit
 * written before the street, rather than certifying two different homes. */
function canUseParsedStreet(property: Partial<Listing>, country: "AU" | "US", address: string) {
  const raw = property.property_address ?? "";
  if (/[\r\n]/.test(raw)) return false;
  const numberedStreet = country === "AU"
    ? /^(?:[a-z0-9]+\/)?\d+[a-z]?(?:-\d+[a-z]?)?\s+\S.*[a-z]/i
    : /^\d+[a-z]?(?:-\d+[a-z]?)?\s+\S.*[a-z]/i;
  if (!numberedStreet.test(address)) return false;
  const parts = raw.split(",").map(part => part.trim());
  if (parts.some(part => !part)) return false;
  const street = parts.shift()!;
  if (country === "AU" && /^(?:unit|apartment|apt)\b/i.test(street)
    && !/^(?:unit|apartment|apt)\s+[a-z0-9]+\s*\//i.test(street)) return false;
  if (country === "US" && usUnitSegment.test(parts[0] ?? "")) parts.shift();
  if (countries[country].test(parts.at(-1) ?? "")) parts.pop();
  if (parts.length && normalize(parts.join(" ")) !== normalize([property.suburb, property.state, property.postcode].filter(Boolean).join(" "))) return false;
  const region = country === "AU" ? street.match(/\s+(ACT|NSW|NT|QLD|SA|TAS|VIC|WA)(?:\s+(\d{4}))?(?:\s+Australia)?$/i) : null;
  if (region && ((property.state && region[1].toUpperCase() !== property.state.toUpperCase())
    || (region[2] && property.postcode && region[2] !== property.postcode))) return false;
  return true;
}

export function calculatorPropertyReviewKey(property: Partial<Listing>) {
  const country = marketForCountry(property.country).country;
  const identity = propertyIdentity(property);
  return JSON.stringify([country, {
    ...identity,
    ...(canUseParsedStreet(property, country, identity.address) ? {} : { fullAddress: normalizeFullAddress(property.property_address ?? "") }),
  }]);
}

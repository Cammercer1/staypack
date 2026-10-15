import { usStreetAddress } from "@/lib/us-property/address";

const regions = {
  AU: /^(?:(.+?)\s+)?(ACT|NSW|NT|QLD|SA|TAS|VIC|WA)\s+(\d{4})$/i,
  US: /^(?:(.+?)\s+)?(AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|AS|GU|MP|PR|VI)\s+(\d{5}(?:-\d{4})?)$/i,
};
const countries = { AU: /^(?:Australia|AU)$/i, US: /^(?:USA|US|United States(?: of America)?)$/i };
const unit = /^(?:apartment\b|apt\b|unit\b|suite\b|ste\b|#)/i;

/** Split completed Places addresses without another lookup or guessing free-form locality. */
export function calculatorLeadAddress(address: string, country: "AU" | "US") {
  const fallback = { property_address: address, suburb: null, state: null, postcode: null };
  const parts = address.split(",").map(part => part.trim());
  if (parts.some(part => !part)) return fallback;
  if (countries[country].test(parts.at(-1) ?? "")) parts.pop();
  if (parts.length < 2) return fallback;
  const region = parts.pop()!.match(regions[country]);
  if (!region) return fallback;
  const suburb = region[1] || (parts.length > 1 ? parts.pop()! : "");
  if (!suburb || unit.test(suburb)) return fallback;
  // A US apartment can occupy its own comma-separated segment. Never discard it.
  if (parts.length !== 1 && !(country === "US" && parts.length === 2 && unit.test(parts[1]))) return fallback;
  const street = country === "US" ? usStreetAddress(parts.join(", ")) : parts[0];
  return { property_address: street, suburb, state: region[2].toUpperCase(), postcode: region[3] };
}

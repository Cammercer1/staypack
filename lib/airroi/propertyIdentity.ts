import { createHash } from "node:crypto";
import { z } from "zod";
import { propertyIdentity } from "@/lib/listings/propertyIdentity";

const propertySchema = z.object({
  property_address: z.string().trim().min(1).max(300),
  suburb: z.string().trim().min(1).max(120),
  state: z.string().trim().min(1).max(30),
  postcode: z.string().trim().min(1).max(10),
  country: z.string().trim().min(1).max(30),
});
type CacheProperty = { [Key in keyof z.infer<typeof propertySchema>]?: string | null };
const auStates = /^(?:ACT|NSW|NT|QLD|SA|TAS|VIC|WA)$/i;
const usStates = /^(?:AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|AS|GU|MP|PR|VI)$/i;
const countries = { AU: /^(?:AU|Australia)$/i, US: /^(?:US|USA|United States(?: of America)?)$/i };
const usUnitSegment = /^(?:apartment|apt\.?|unit|suite|ste\.?|#)\s*#?\s*(?:(?:penthouse|ph)\s+)?[a-z0-9]+(?:-[a-z0-9]+)?$/i;
const normalize = (value: string) => value.toLowerCase().replace(/[–—]/g, "-").replace(/\./g, "").replace(/\s+/g, " ").trim();

/** Never let the existing display-address normalizer discard an unidentified unit. */
function streetForIdentity(property: z.infer<typeof propertySchema>, country: "AU" | "US") {
  if (/[\r\n]/.test(property.property_address)) return null;
  const parts = property.property_address.split(",").map(part => part.trim());
  if (parts.some(part => !part)) return null;
  const street = parts.shift()!;
  let unit = "";
  if (country === "US" && usUnitSegment.test(parts[0] ?? "")) unit = ` ${parts.shift()}`;
  if (countries[country].test(parts.at(-1) ?? "")) parts.pop();
  if (parts.length && normalize(parts.join(" ")) !== normalize(`${property.suburb} ${property.state} ${property.postcode}`)) return null;
  // "Unit 2, 24 Main St" and "Unit 24 Main St" are ambiguous; neither may
  // collapse to a house or another apartment at the same geocoded building.
  if (country === "AU" && /^(?:unit|apartment|apt)\b/i.test(street) &&
    !/^(?:unit|apartment|apt)\s+[a-z0-9]+\s*\//i.test(street)) return null;
  const auRegion = country === "AU" ? street.match(/\s+(ACT|NSW|NT|QLD|SA|TAS|VIC|WA)(?:\s+(\d{4}))?(?:\s+Australia)?$/i) : null;
  if (auRegion && (auRegion[1].toUpperCase() !== property.state.toUpperCase() ||
    auRegion[2] && auRegion[2] !== property.postcode)) return null;
  return `${street}${unit}`;
}

/** Complete address identity only: proximity alone never identifies a property. */
export function airroiPropertyKey(property: CacheProperty): string | null {
  const parsed = propertySchema.safeParse(property);
  if (!parsed.success) return null;
  const input = parsed.data;
  const country = countries.AU.test(input.country) ? "AU" : countries.US.test(input.country) ? "US" : null;
  if (!country || !(country === "AU" ? auStates : usStates).test(input.state) ||
    !(country === "AU" ? /^\d{4}$/ : /^\d{5}(?:-\d{4})?$/).test(input.postcode)) return null;
  const street = streetForIdentity(input, country);
  if (!street) return null;
  const identity = propertyIdentity({ ...input, country, property_address: street });
  // Require a numbered street, preserving units, lettered numbers and ranges.
  // Non-standard addresses safely retain the ordinary exact-coordinate cache.
  const numberedStreet = country === "AU"
    ? /^(?:[a-z0-9]+\/)?\d+[a-z]?(?:-\d+[a-z]?)?\s+\S.*[a-z]/i
    : /^\d+[a-z]?(?:-\d+[a-z]?)?\s+\S.*[a-z]/i;
  if (!numberedStreet.test(identity.address)) return null;
  return createHash("sha256").update(JSON.stringify([
    "airroi-property-v1", country, identity.address, identity.suburb, identity.state, identity.postcode,
  ])).digest("hex");
}

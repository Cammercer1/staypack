import { agencySchema, type AgencyInput } from "@/lib/validation/schemas";
import {
  agencyToFormInput,
  normalizeAgencyBrandPayload,
} from "@/lib/branding/normalize";
import type { Agency } from "@/lib/types";

const detailsFields = {
  country_code: true,
  name: true,
  slug: true,
  website_url: true,
  email: true,
  phone: true,
} as const;
export const agencyDetailsSchema = agencySchema.pick(detailsFields);
export const brandSettingsSchema = agencySchema.omit(detailsFields);
export type AgencySettingsSection = "details" | "brand";

export function selectAgencySettings(
  values: AgencyInput,
  section: AgencySettingsSection,
) {
  return section === "details"
    ? agencyDetailsSchema.parse(values)
    : brandSettingsSchema.parse(values);
}

/** Only write the fields owned by the submitted page, even when another page is stale. */
export function parseAgencySettingsUpdate(input: unknown, current: Agency) {
  const section =
    input && typeof input === "object" && "settings_section" in input
      ? input.settings_section
      : undefined;
  if (section === undefined) {
    const values = agencySchema.parse(input);
    return normalizeAgencyBrandPayload({ ...values, country_code: values.country_code ?? current.country_code ?? "AU" });
  }
  if (section === "details") {
    const details = agencyDetailsSchema.parse(input);
    return {
      ...details,
      website_url: details.website_url || null,
      email: details.email || null,
      phone: details.phone || null,
    };
  }
  if (section !== "brand") throw new Error("Invalid settings section");
  const brand = brandSettingsSchema.parse(input);
  const normalized = normalizeAgencyBrandPayload({
    ...agencyToFormInput(current),
    ...brand,
  });
  return Object.fromEntries(
    Object.entries(normalized).filter(([key]) => !(key in detailsFields)),
  );
}

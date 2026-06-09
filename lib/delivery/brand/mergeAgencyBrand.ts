import type { DeliveryTenantBrand } from "@/lib/delivery/brand/schema";
import { DEFAULT_DELIVERY_BRAND } from "@/lib/delivery/brand/schema";
import type { Agency } from "@/lib/types";

function pick<T>(override: T | undefined | null, fallback: T): T {
  if (override === undefined || override === null) return fallback;
  if (typeof override === "string" && override.trim() === "") return fallback;
  return override;
}

/** Apply tenant brand_json overrides onto an agency row (delivery-only; does not persist). */
export function mergeAgencyWithTenantBrand(
  agency: Agency,
  brand: DeliveryTenantBrand | null | undefined,
  tenantDisplayName: string,
): Agency {
  if (!brand || Object.keys(brand).length === 0) {
    return agency;
  }

  const defaults = DEFAULT_DELIVERY_BRAND;

  return {
    ...agency,
    name: pick(brand.displayName, agency.name) || tenantDisplayName,
    website_url: pick(brand.website_url, agency.website_url),
    email: pick(brand.email, agency.email),
    phone: pick(brand.phone, agency.phone),
    logo_url: pick(brand.logo_url, agency.logo_url),
    logo_light_url: pick(brand.logo_light_url, agency.logo_light_url),
    logo_dark_url: pick(brand.logo_dark_url, agency.logo_dark_url),
    primary_colour: pick(brand.primary_colour, agency.primary_colour) ?? defaults.primary_colour,
    secondary_colour: pick(brand.secondary_colour, agency.secondary_colour) ?? defaults.secondary_colour,
    accent_colour: pick(brand.accent_colour, agency.accent_colour) ?? defaults.accent_colour,
    text_colour: pick(brand.text_colour, agency.text_colour) ?? defaults.text_colour,
    callout_heading_colour: pick(brand.callout_heading_colour, agency.callout_heading_colour),
    callout_text_colour: pick(brand.callout_text_colour, agency.callout_text_colour),
    background_colour:
      pick(brand.background_colour, agency.background_colour) ?? defaults.background_colour,
    heading_font_family:
      pick(brand.heading_font_family, agency.heading_font_family) ?? defaults.heading_font_family,
    body_font_family:
      pick(brand.body_font_family, agency.body_font_family) ?? defaults.body_font_family,
    font_family: pick(brand.font_family, agency.font_family),
    heading_font_file_url: pick(brand.heading_font_file_url, agency.heading_font_file_url),
    body_font_file_url: pick(brand.body_font_file_url, agency.body_font_file_url),
    font_file_url: pick(brand.font_file_url, agency.font_file_url),
    default_report_title: pick(brand.default_report_title, agency.default_report_title),
    default_cta: pick(brand.default_cta, agency.default_cta),
    default_disclaimer: pick(brand.default_disclaimer, agency.default_disclaimer),
    report_template_id: brand.report_template_id
      ? brand.report_template_id
      : agency.report_template_id,
    brand_advanced_json:
      brand.brand_advanced_json !== undefined
        ? brand.brand_advanced_json
        : agency.brand_advanced_json,
  };
}

/** Build a full Agency object from tenant brand only (no app account). */
export function agencyFromTenantBrand(
  tenantSlug: string,
  tenantName: string,
  brand: DeliveryTenantBrand,
  agencyId: string,
): Agency {
  const d = DEFAULT_DELIVERY_BRAND;
  const now = new Date().toISOString();

  return {
    id: agencyId,
    name: brand.displayName ?? tenantName,
    slug: `md-${tenantSlug}`,
    slug_aliases: [],
    website_url: brand.website_url ?? null,
    email: brand.email ?? null,
    phone: brand.phone ?? null,
    logo_url: brand.logo_url ?? null,
    logo_light_url: brand.logo_light_url ?? null,
    logo_dark_url: brand.logo_dark_url ?? brand.logo_url ?? null,
    primary_colour: brand.primary_colour ?? d.primary_colour,
    secondary_colour: brand.secondary_colour ?? d.secondary_colour,
    accent_colour: brand.accent_colour ?? d.accent_colour,
    text_colour: brand.text_colour ?? d.text_colour,
    callout_heading_colour: brand.callout_heading_colour ?? null,
    callout_text_colour: brand.callout_text_colour ?? null,
    background_colour: brand.background_colour ?? d.background_colour,
    heading_font_family: brand.heading_font_family ?? d.heading_font_family,
    body_font_family: brand.body_font_family ?? d.body_font_family,
    font_family: brand.font_family ?? "inter",
    heading_font_file_url: brand.heading_font_file_url ?? null,
    body_font_file_url: brand.body_font_file_url ?? null,
    font_file_url: brand.font_file_url ?? null,
    default_report_title:
      brand.default_report_title ?? "Short-Term Rental Potential Report",
    default_cta:
      brand.default_cta ??
      "Speak with the agent for the full buyer pack and property details.",
    default_disclaimer: brand.default_disclaimer ?? null,
    report_template_id: brand.report_template_id ?? "minimalist-detailed",
    collateral_template_defaults: {},
    brand_advanced_json: brand.brand_advanced_json ?? null,
    created_at: now,
    updated_at: now,
  };
}

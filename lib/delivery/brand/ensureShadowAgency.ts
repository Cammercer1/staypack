import { createAdminClient } from "@/lib/supabase/admin";
import {
  agencyFromTenantBrand,
  mergeAgencyWithTenantBrand,
} from "@/lib/delivery/brand/mergeAgencyBrand";
import type { DeliveryTenantBrand } from "@/lib/delivery/brand/schema";
import type { Agency } from "@/lib/types";

const SHADOW_SLUG_PREFIX = "md-";

export function shadowAgencySlug(tenantSlug: string) {
  return `${SHADOW_SLUG_PREFIX}${tenantSlug}`;
}

/**
 * Resolve agency for delivery: optional linked agency + tenant brand overrides,
 * or auto-provision a shadow agency (no app users / members).
 */
export async function resolveDeliveryAgency({
  tenantId,
  tenantSlug,
  tenantName,
  agencyId,
  brand,
}: {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  agencyId: string | null;
  brand: DeliveryTenantBrand | null;
}): Promise<Agency> {
  const admin = createAdminClient();
  const hasBrand = brand && Object.keys(brand).length > 0;

  if (agencyId) {
    const { data, error } = await admin
      .from("agencies")
      .select("*")
      .eq("id", agencyId)
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Linked agency not found");
    }

    return mergeAgencyWithTenantBrand(
      data as Agency,
      brand,
      tenantName,
    );
  }

  if (!hasBrand) {
    throw new Error(
      "Delivery tenant needs either agency_id or brand_json (managed clients without app access)",
    );
  }

  const slug = shadowAgencySlug(tenantSlug);

  const { data: existing } = await admin
    .from("agencies")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (existing) {
    const synced = agencyFromTenantBrand(
      tenantSlug,
      tenantName,
      brand!,
      existing.id,
    );

    await admin
      .from("agencies")
      .update({
        name: synced.name,
        website_url: synced.website_url,
        email: synced.email,
        phone: synced.phone,
        logo_url: synced.logo_url,
        logo_light_url: synced.logo_light_url,
        logo_dark_url: synced.logo_dark_url,
        primary_colour: synced.primary_colour,
        secondary_colour: synced.secondary_colour,
        accent_colour: synced.accent_colour,
        text_colour: synced.text_colour,
        callout_heading_colour: synced.callout_heading_colour,
        callout_text_colour: synced.callout_text_colour,
        background_colour: synced.background_colour,
        heading_font_family: synced.heading_font_family,
        body_font_family: synced.body_font_family,
        font_family: synced.font_family,
        heading_font_file_url: synced.heading_font_file_url,
        body_font_file_url: synced.body_font_file_url,
        font_file_url: synced.font_file_url,
        default_report_title: synced.default_report_title,
        default_cta: synced.default_cta,
        default_disclaimer: synced.default_disclaimer,
        report_template_id: synced.report_template_id,
        brand_advanced_json: synced.brand_advanced_json,
      })
      .eq("id", existing.id);

    await admin
      .from("delivery_tenants")
      .update({ agency_id: existing.id })
      .eq("id", tenantId);

    return synced;
  }

  const { data: created, error: insertError } = await admin
    .from("agencies")
    .insert({
      name: brand!.displayName ?? tenantName,
      slug,
      website_url: brand!.website_url ?? null,
      email: brand!.email ?? null,
      phone: brand!.phone ?? null,
      logo_url: brand!.logo_url ?? null,
      logo_light_url: brand!.logo_light_url ?? null,
      logo_dark_url: brand!.logo_dark_url ?? brand!.logo_url ?? null,
      primary_colour: brand!.primary_colour ?? "#111111",
      secondary_colour: brand!.secondary_colour ?? "#FFFFFF",
      accent_colour: brand!.accent_colour ?? "#F4F4F5",
      text_colour: brand!.text_colour ?? "#002e36",
      callout_heading_colour: brand!.callout_heading_colour ?? null,
      callout_text_colour: brand!.callout_text_colour ?? null,
      background_colour: brand!.background_colour ?? "#f9f5ea",
      heading_font_family: brand!.heading_font_family ?? "fraunces",
      body_font_family: brand!.body_font_family ?? "inter",
      font_family: brand!.font_family ?? "inter",
      heading_font_file_url: brand!.heading_font_file_url ?? null,
      body_font_file_url: brand!.body_font_file_url ?? null,
      font_file_url: brand!.font_file_url ?? null,
      default_report_title:
        brand!.default_report_title ?? "Short-Term Rental Potential Report",
      default_cta:
        brand!.default_cta ??
        "Speak with the agent for the full buyer pack and property details.",
      default_disclaimer: brand!.default_disclaimer ?? null,
      report_template_id: brand!.report_template_id ?? "minimalist-detailed",
      brand_advanced_json: brand!.brand_advanced_json ?? {},
    })
    .select("*")
    .single();

  if (insertError || !created) {
    throw new Error(insertError?.message ?? "Failed to create shadow agency");
  }

  await admin
    .from("delivery_tenants")
    .update({ agency_id: created.id })
    .eq("id", tenantId);

  return agencyFromTenantBrand(
    tenantSlug,
    tenantName,
    brand!,
    created.id,
  );
}

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  DeliveryBillingMode,
  DeliveryTenant,
  ScrapeSchedule,
  TenantBillingConfig,
} from "@/lib/delivery/types";
import type { DeliveryTenantBrand } from "@/lib/delivery/brand/schema";
import type { DeliveryTenantInput } from "@/lib/delivery/tenants/schema";
import type { PartnerSource } from "@/lib/delivery/types";

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  agency_id: string | null;
  brand_json: DeliveryTenantBrand;
  enabled: boolean;
  timezone: string;
  scrape_enabled: boolean;
  scrape_schedule: ScrapeSchedule;
  last_scrape_at: string | null;
  partner_sources: PartnerSource[];
  email_recipients: string[];
  email_from: string | null;
  email_subject_template: string | null;
  str_template_pack_id: string | null;
  deliverables: string[];
  billing_mode: DeliveryBillingMode;
  billing: TenantBillingConfig;
  feature_flags: Record<string, unknown>;
  reprocess_on_material_change: boolean;
};

function mapTenant(row: TenantRow): DeliveryTenant {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    agency_id: row.agency_id,
    brand: row.brand_json ?? {},
    enabled: row.enabled,
    timezone: row.timezone,
    scrape_enabled: row.scrape_enabled,
    scrape_schedule: row.scrape_schedule,
    last_scrape_at: row.last_scrape_at,
    partner_sources: row.partner_sources ?? [],
    email_recipients: row.email_recipients ?? [],
    email_from: row.email_from,
    email_subject_template: row.email_subject_template,
    str_template_pack_id: row.str_template_pack_id,
    deliverables: (row.deliverables ?? ["str"]) as DeliveryTenant["deliverables"],
    billing_mode: row.billing_mode,
    billing: row.billing ?? {},
    feature_flags: row.feature_flags ?? {},
    reprocess_on_material_change: row.reprocess_on_material_change,
  };
}

export async function listDeliveryTenants(): Promise<DeliveryTenant[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("delivery_tenants")
    .select("*")
    .order("slug");

  if (error) throw new Error(error.message);
  return (data as TenantRow[]).map(mapTenant);
}

export async function getDeliveryTenantBySlug(
  slug: string,
): Promise<DeliveryTenant | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("delivery_tenants")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapTenant(data as TenantRow);
}

export async function getDeliveryTenantById(
  id: string,
): Promise<DeliveryTenant | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("delivery_tenants")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapTenant(data as TenantRow);
}

export async function upsertDeliveryTenant(
  input: DeliveryTenantInput,
): Promise<DeliveryTenant> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("delivery_tenants")
    .upsert(
      {
        slug: input.slug,
        name: input.name,
        agency_id: input.agency_id ?? null,
        brand_json: input.brand ?? {},
        enabled: input.enabled,
        timezone: input.timezone,
        scrape_enabled: input.scrape_enabled,
        scrape_schedule: input.scrape_schedule,
        partner_sources: input.partner_sources,
        email_recipients: input.email_recipients,
        email_from: input.email_from ?? null,
        email_subject_template:
          input.email_subject_template ?? "Short-term rental appraisal: {{address}}",
        str_template_pack_id: input.str_template_pack_id ?? null,
        deliverables: input.deliverables,
        billing_mode: input.billing_mode,
        billing: input.billing,
        feature_flags: input.feature_flags,
        reprocess_on_material_change: input.reprocess_on_material_change,
      },
      { onConflict: "slug" },
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapTenant(data as TenantRow);
}

export async function touchTenantLastScrapeAt(tenantId: string) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("delivery_tenants")
    .update({ last_scrape_at: new Date().toISOString() })
    .eq("id", tenantId);

  if (error) throw new Error(error.message);
}

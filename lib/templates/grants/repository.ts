import { createAdminClient } from "@/lib/supabase/admin";
import type { TemplateProduct } from "@/lib/templates/types";

export type AccountTemplateGrant = {
  id: string;
  agency_id: string;
  template_id: string;
  product: TemplateProduct;
  is_default: boolean;
  created_at: string;
};

type GrantRow = {
  id: string;
  agency_id: string;
  template_id: string;
  product: string;
  is_default: boolean;
  created_at: string;
};

function mapGrant(row: GrantRow): AccountTemplateGrant {
  return {
    id: row.id,
    agency_id: row.agency_id,
    template_id: row.template_id,
    product: row.product as TemplateProduct,
    is_default: row.is_default,
    created_at: row.created_at,
  };
}

export async function listGrantsForAgency(
  agencyId: string,
): Promise<AccountTemplateGrant[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("account_template_grants")
    .select("*")
    .eq("agency_id", agencyId);

  if (error) {
    throw new Error(error.message);
  }

  return (data as GrantRow[]).map(mapGrant);
}

export async function isTemplateGranted(
  agencyId: string,
  templateId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("account_template_grants")
    .select("id")
    .eq("agency_id", agencyId)
    .eq("template_id", templateId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function getDefaultTemplateIdFromGrants(
  agencyId: string,
  product: TemplateProduct,
): Promise<string | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("account_template_grants")
    .select("template_id")
    .eq("agency_id", agencyId)
    .eq("product", product)
    .eq("is_default", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.template_id ?? null;
}

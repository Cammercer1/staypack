import { createAdminClient } from "@/lib/supabase/admin";
import type {
  TemplateCatalogMode,
  TemplateProduct,
} from "@/lib/templates/types";

export type AccountTemplateGrant = {
  id: string;
  agency_id: string;
  template_id: string;
  product: TemplateProduct;
  is_default: boolean;
  created_at: string;
};

type TemplateGrantRow = {
  template_id: string;
  product: string;
  is_default: boolean;
};

type GrantRow = TemplateGrantRow & {
  id: string;
  agency_id: string;
  created_at: string;
};

export type TemplateGrant = Pick<
  AccountTemplateGrant,
  "template_id" | "product" | "is_default"
>;

export type TemplateAccessConfiguration = {
  agencyGrants: TemplateGrant[];
  groupGrants: TemplateGrant[];
  agencyCatalogMode: TemplateCatalogMode | null;
  groupCatalogMode: TemplateCatalogMode | null;
};

type CatalogModeRow = {
  catalog_mode: string;
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

function mapTemplateGrant(row: TemplateGrantRow): TemplateGrant {
  return {
    template_id: row.template_id,
    product: row.product as TemplateProduct,
    is_default: row.is_default,
  };
}

function mapCatalogMode(row: CatalogModeRow | null): TemplateCatalogMode | null {
  if (
    row?.catalog_mode === "platform_plus_grants" ||
    row?.catalog_mode === "grants_only"
  ) {
    return row.catalog_mode;
  }
  return null;
}

/** Load office and inherited group access in the server-only data layer. */
export async function loadTemplateAccessForAgency(
  agencyId: string,
  agencyGroupId: string | null,
  product: TemplateProduct,
): Promise<TemplateAccessConfiguration> {
  const admin = createAdminClient();
  const [agencyGrantsResult, agencySettingsResult] = await Promise.all([
    admin
      .from("account_template_grants")
      .select("id, agency_id, template_id, product, is_default, created_at")
      .eq("agency_id", agencyId)
      .eq("product", product),
    admin
      .from("agency_product_settings")
      .select("catalog_mode")
      .eq("agency_id", agencyId)
      .eq("product", product)
      .maybeSingle(),
  ]);

  if (agencyGrantsResult.error) {
    throw new Error(agencyGrantsResult.error.message);
  }
  if (agencySettingsResult.error) {
    throw new Error(agencySettingsResult.error.message);
  }

  let groupGrants: TemplateGrant[] = [];
  let groupCatalogMode: TemplateCatalogMode | null = null;

  if (agencyGroupId) {
    const [groupGrantsResult, groupSettingsResult] = await Promise.all([
      admin
        .from("agency_group_template_grants")
        .select(
          "id, agency_group_id, template_id, product, is_default, created_at",
        )
        .eq("agency_group_id", agencyGroupId)
        .eq("product", product),
      admin
        .from("agency_group_product_settings")
        .select("catalog_mode")
        .eq("agency_group_id", agencyGroupId)
        .eq("product", product)
        .maybeSingle(),
    ]);

    if (groupGrantsResult.error) {
      throw new Error(groupGrantsResult.error.message);
    }
    if (groupSettingsResult.error) {
      throw new Error(groupSettingsResult.error.message);
    }

    groupGrants = (groupGrantsResult.data as TemplateGrantRow[]).map(
      mapTemplateGrant,
    );
    groupCatalogMode = mapCatalogMode(
      groupSettingsResult.data as CatalogModeRow | null,
    );
  }

  return {
    agencyGrants: (agencyGrantsResult.data as GrantRow[]).map(mapTemplateGrant),
    groupGrants,
    agencyCatalogMode: mapCatalogMode(
      agencySettingsResult.data as CatalogModeRow | null,
    ),
    groupCatalogMode,
  };
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

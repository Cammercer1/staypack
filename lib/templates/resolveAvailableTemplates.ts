import { DEFAULT_COLLATERAL_TEMPLATE_IDS } from "@/lib/collateral/templates/ids";
import { DEFAULT_REPORT_TEMPLATE_ID } from "@/lib/reports/templates/ids";
import { getTemplatesForProduct } from "@/lib/templates/catalog";
import type { TemplateCatalogEntry } from "@/lib/templates/types";
import {
  getDefaultTemplateIdFromGrants,
  listGrantsForAgency,
} from "@/lib/templates/grants/repository";
import type {
  AvailableTemplatesResult,
  TemplateProduct,
} from "@/lib/templates/types";
import type { Agency } from "@/lib/types";

function agencyDefaultForProduct(
  agency: Agency,
  product: TemplateProduct,
): string | null {
  if (product === "str") {
    return agency.report_template_id || null;
  }
  if (product === "lease") {
    return null;
  }
  const defaults = agency.collateral_template_defaults ?? {};
  if (product === "sales_brochure") {
    return defaults.sales_brochure ?? null;
  }
  if (product === "rental_brochure") {
    return defaults.rental_brochure ?? null;
  }
  return null;
}

function platformDefaultForProduct(product: TemplateProduct): string {
  if (product === "str") {
    return DEFAULT_REPORT_TEMPLATE_ID;
  }
  if (product === "lease") {
    return "classic-lease-appraisal";
  }
  const collateralDefault =
    DEFAULT_COLLATERAL_TEMPLATE_IDS[
      product as keyof typeof DEFAULT_COLLATERAL_TEMPLATE_IDS
    ];
  return collateralDefault ?? DEFAULT_REPORT_TEMPLATE_ID;
}

function filterByGrants(
  templates: TemplateCatalogEntry[],
  grantedIds: Set<string>,
): TemplateCatalogEntry[] {
  return templates.filter(
    (entry) => entry.scope === "platform" || grantedIds.has(entry.id),
  );
}

function pickDefaultId(
  available: TemplateCatalogEntry[],
  candidates: (string | null | undefined)[],
  product: TemplateProduct,
): string {
  const ids = new Set(available.map((entry) => entry.id));
  for (const candidate of candidates) {
    if (candidate && ids.has(candidate)) {
      return candidate;
    }
  }
  return available[0]?.id ?? platformDefaultForProduct(product);
}

export async function resolveAvailableTemplates(
  agency: Agency,
  product: TemplateProduct,
): Promise<AvailableTemplatesResult> {
  const allForProduct = getTemplatesForProduct(product);
  const grants = await listGrantsForAgency(agency.id);
  const grantedIds = new Set(
    grants.filter((g) => g.product === product).map((g) => g.template_id),
  );
  const templates = filterByGrants(allForProduct, grantedIds);

  const grantDefault = await getDefaultTemplateIdFromGrants(agency.id, product);
  const defaultTemplateId = pickDefaultId(
    templates,
    [grantDefault, agencyDefaultForProduct(agency, product)],
    product,
  );

  return {
    product,
    defaultTemplateId,
    templates,
  };
}

/** Sync helper for UI when grants are already loaded (e.g. from API response). */
export function resolveAvailableTemplatesFromGrants(
  agency: Agency,
  product: TemplateProduct,
  grants: { template_id: string; product: string; is_default: boolean }[],
): AvailableTemplatesResult {
  const allForProduct = getTemplatesForProduct(product);
  const grantedIds = new Set(
    grants.filter((g) => g.product === product).map((g) => g.template_id),
  );
  const templates = filterByGrants(allForProduct, grantedIds);
  const grantDefault =
    grants.find((g) => g.product === product && g.is_default)?.template_id ??
    null;
  const defaultTemplateId = pickDefaultId(
    templates,
    [grantDefault, agencyDefaultForProduct(agency, product)],
    product,
  );

  return {
    product,
    defaultTemplateId,
    templates,
  };
}

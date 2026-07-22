import { DEFAULT_COLLATERAL_TEMPLATE_IDS } from "@/lib/collateral/templates/ids";
import { DEFAULT_REPORT_TEMPLATE_ID } from "@/lib/reports/templates/ids";
import { getTemplatesForProduct } from "@/lib/templates/catalog";
import {
  loadTemplateAccessForAgency,
  type TemplateAccessConfiguration,
  type TemplateGrant,
} from "@/lib/templates/grants/repository";
import type {
  AvailableTemplatesResult,
  TemplateCatalogMode,
  TemplateCatalogEntry,
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
  if (product === "lease" || product === "sales_appraisal") {
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
  if (product === "sales_appraisal") {
    return "classic-sales-appraisal";
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
  catalogMode: TemplateCatalogMode,
): TemplateCatalogEntry[] {
  if (catalogMode === "grants_only") {
    return templates.filter((entry) => grantedIds.has(entry.id));
  }

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

export class TemplateAccessConfigurationError extends Error {
  constructor(product: TemplateProduct) {
    super(`No ${product} templates are available for this account`);
    this.name = "TemplateAccessConfigurationError";
  }
}

function moveTemplateToFront(
  templates: TemplateCatalogEntry[],
  templateId: string,
): TemplateCatalogEntry[] {
  const index = templates.findIndex((entry) => entry.id === templateId);
  if (index <= 0) {
    return templates;
  }

  const selected = templates[index];
  return [
    selected,
    ...templates.slice(0, index),
    ...templates.slice(index + 1),
  ];
}

export async function resolveAvailableTemplates(
  agency: Agency,
  product: TemplateProduct,
): Promise<AvailableTemplatesResult> {
  const access = await loadTemplateAccessForAgency(
    agency.id,
    agency.agency_group_id ?? null,
    product,
  );
  return resolveAvailableTemplatesFromAccess(agency, product, access);
}

export function resolveAvailableTemplatesFromAccess(
  agency: Agency,
  product: TemplateProduct,
  access: TemplateAccessConfiguration,
): AvailableTemplatesResult {
  const allForProduct = getTemplatesForProduct(product);
  const catalogMode =
    access.agencyCatalogMode ??
    access.groupCatalogMode ??
    "platform_plus_grants";
  const grants = [...access.groupGrants, ...access.agencyGrants];
  const grantedIds = new Set(
    grants.filter((g) => g.product === product).map((g) => g.template_id),
  );
  const templates = filterByGrants(allForProduct, grantedIds, catalogMode);

  if (templates.length === 0) {
    throw new TemplateAccessConfigurationError(product);
  }

  const agencyGrantDefault = access.agencyGrants.find(
    (g) => g.product === product && g.is_default,
  )?.template_id;
  const groupGrantDefault = access.groupGrants.find(
    (g) => g.product === product && g.is_default,
  )?.template_id;
  const defaultTemplateId = pickDefaultId(
    templates,
    [
      agencyGrantDefault,
      groupGrantDefault,
      agencyDefaultForProduct(agency, product),
    ],
    product,
  );

  return {
    product,
    defaultTemplateId,
    templates: moveTemplateToFront(templates, defaultTemplateId),
  };
}

/** Backwards-compatible sync helper for callers with office grants only. */
export function resolveAvailableTemplatesFromGrants(
  agency: Agency,
  product: TemplateProduct,
  grants: TemplateGrant[],
): AvailableTemplatesResult {
  return resolveAvailableTemplatesFromAccess(agency, product, {
    agencyGrants: grants,
    groupGrants: [],
    agencyCatalogMode: null,
    groupCatalogMode: null,
  });
}

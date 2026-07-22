import type { BlurbLength } from "@/lib/copy/blurbVariantConstants";
import type { ReportTemplateTier } from "@/lib/reports/templates/types";
import type { CollateralPageFormatId } from "@/lib/collateral/templates/types";
import type { CollateralType } from "@/lib/types";

export type TemplateProduct =
  | "str"
  | "lease"
  | "sales_appraisal"
  | "sales_brochure"
  | "rental_brochure";

export type TemplateScope = "platform" | "account";

export type TemplateCatalogMode = "platform_plus_grants" | "grants_only";

export type TemplateBrandMode = "agency" | "fixed" | "agency_with_overrides";

/** Shared metadata for report and brochure templates in the catalog. */
export type TemplateCatalogMetadata = {
  product: TemplateProduct;
  scope: TemplateScope;
  brandMode: TemplateBrandMode;
  defaultBlurbLength: BlurbLength;
  blurbLengthLocked: boolean;
  fixedBrandKitId?: string;
};

export type ReportTemplateCatalogEntry = TemplateCatalogMetadata & {
  kind: "report";
  id: string;
  family: string;
  tier: ReportTemplateTier;
  label: string;
  description: string;
  pages: number;
  sourcePath: string;
};

export type CollateralTemplateCatalogEntry = TemplateCatalogMetadata & {
  kind: "collateral";
  id: string;
  collateralType: Extract<CollateralType, "sales_brochure" | "rental_brochure">;
  label: string;
  description: string;
  pageFormat: CollateralPageFormatId;
  pages: number;
  family: string;
};

export type TemplateCatalogEntry =
  | ReportTemplateCatalogEntry
  | CollateralTemplateCatalogEntry;

export type AvailableTemplatesResult = {
  product: TemplateProduct;
  defaultTemplateId: string;
  templates: TemplateCatalogEntry[];
};

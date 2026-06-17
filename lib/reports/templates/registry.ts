import { ClassicDetailedTemplate } from "@/lib/reports/templates/classic/DetailedTemplate";
import { BoldDetailedTemplate } from "@/lib/reports/templates/bold/BoldTemplate";
import { GalleryDetailedTemplate } from "@/lib/reports/templates/gallery/GalleryTemplate";
import { EditorialDetailedTemplate } from "@/lib/reports/templates/editorial/EditorialTemplate";
import { SplitDetailedTemplate } from "@/lib/reports/templates/split/SplitTemplate";
import { RefinedDetailedTemplate } from "@/lib/reports/templates/refined/RefinedTemplate";
import { MinimalistDetailedTemplate } from "@/lib/reports/templates/minimalist/MinimalistTemplate";
import { LandmarkDetailedTemplate } from "@/lib/reports/templates/landmark/LandmarkTemplate";
import { HavenPropertiesStrTemplate } from "@/lib/reports/templates/haven-properties/HavenPropertiesStrTemplate";
import { HavenPropertiesLeaseAppraisalTemplate } from "@/lib/reports/templates/haven-properties/HavenPropertiesLeaseAppraisalTemplate";
import { BellePropertyStrTemplate } from "@/lib/reports/templates/belle-property/BellePropertyStrTemplate";
import { BellePropertyLeaseAppraisalTemplate } from "@/lib/reports/templates/belle-property/BellePropertyLeaseAppraisalTemplate";
import {
  BoldLeaseAppraisalTemplate,
  ClassicLeaseAppraisalTemplate,
  EditorialLeaseAppraisalTemplate,
  GalleryLeaseAppraisalTemplate,
  LandmarkLeaseAppraisalTemplate,
  MinimalistLeaseAppraisalTemplate,
  RefinedLeaseAppraisalTemplate,
  SplitLeaseAppraisalTemplate,
} from "@/lib/reports/templates/lease-appraisal/LeaseAppraisalFamilyTemplates";
import {
  CLASSIC_DETAILED_TEMPLATE_ID,
  DEFAULT_REPORT_TEMPLATE_ID,
  BOLD_DETAILED_TEMPLATE_ID,
  GALLERY_DETAILED_TEMPLATE_ID,
  EDITORIAL_DETAILED_TEMPLATE_ID,
  SPLIT_DETAILED_TEMPLATE_ID,
  REFINED_DETAILED_TEMPLATE_ID,
  MINIMALIST_DETAILED_TEMPLATE_ID,
  LANDMARK_DETAILED_TEMPLATE_ID,
  HAVEN_PROPERTIES_STR_TEMPLATE_ID,
  HAVEN_PROPERTIES_LEASE_APPRAISAL_TEMPLATE_ID,
  BELLE_PROPERTY_STR_TEMPLATE_ID,
  BELLE_PROPERTY_LEASE_APPRAISAL_TEMPLATE_ID,
  CLASSIC_LEASE_APPRAISAL_TEMPLATE_ID,
  BOLD_LEASE_APPRAISAL_TEMPLATE_ID,
  GALLERY_LEASE_APPRAISAL_TEMPLATE_ID,
  EDITORIAL_LEASE_APPRAISAL_TEMPLATE_ID,
  SPLIT_LEASE_APPRAISAL_TEMPLATE_ID,
  REFINED_LEASE_APPRAISAL_TEMPLATE_ID,
  MINIMALIST_LEASE_APPRAISAL_TEMPLATE_ID,
  LANDMARK_LEASE_APPRAISAL_TEMPLATE_ID,
  isValidReportTemplateId,
  normalizeReportTemplateId,
  REPORT_TEMPLATE_IDS,
} from "@/lib/reports/templates/ids";
import type { ReportTemplateDefinition } from "@/lib/reports/templates/types";

export {
  DEFAULT_REPORT_TEMPLATE_ID,
  isValidReportTemplateId,
  normalizeReportTemplateId,
  REPORT_TEMPLATE_IDS,
};

export const REPORT_TEMPLATES: ReportTemplateDefinition[] = [
  {
    id: CLASSIC_DETAILED_TEMPLATE_ID,
    family: "classic",
    tier: "detailed",
    label: "Classic",
    description: "Two-page report with revenue range, comparable listings, and seasonality.",
    pages: 2,
    sourcePath: "lib/reports/templates/classic",
    Component: ClassicDetailedTemplate,
  },
  {
    id: BOLD_DETAILED_TEMPLATE_ID,
    family: "bold",
    tier: "detailed",
    label: "Bold",
    description: "Dramatic hero cover with full market evidence page 2.",
    pages: 2,
    sourcePath: "lib/reports/templates/bold",
    Component: BoldDetailedTemplate,
  },
  {
    id: GALLERY_DETAILED_TEMPLATE_ID,
    family: "gallery",
    tier: "detailed",
    label: "Gallery",
    description: "Gallery cover with full market evidence page 2.",
    pages: 2,
    sourcePath: "lib/reports/templates/gallery",
    Component: GalleryDetailedTemplate,
  },
  {
    id: EDITORIAL_DETAILED_TEMPLATE_ID,
    family: "editorial",
    tier: "detailed",
    label: "Editorial",
    description: "Magazine cover with full market evidence page 2.",
    pages: 2,
    sourcePath: "lib/reports/templates/editorial",
    Component: EditorialDetailedTemplate,
  },
  {
    id: SPLIT_DETAILED_TEMPLATE_ID,
    family: "split",
    tier: "detailed",
    label: "Split",
    description: "Split layout cover with full market evidence page 2.",
    pages: 2,
    sourcePath: "lib/reports/templates/split",
    Component: SplitDetailedTemplate,
  },
  {
    id: REFINED_DETAILED_TEMPLATE_ID,
    family: "refined",
    tier: "detailed",
    label: "Refined",
    description: "Refined cover with full market evidence page 2.",
    pages: 2,
    sourcePath: "lib/reports/templates/refined",
    Component: RefinedDetailedTemplate,
  },
  {
    id: MINIMALIST_DETAILED_TEMPLATE_ID,
    family: "minimalist",
    tier: "detailed",
    label: "Minimalist",
    description: "Minimalist cover with full market evidence page 2.",
    pages: 2,
    sourcePath: "lib/reports/templates/minimalist",
    Component: MinimalistDetailedTemplate,
  },
  {
    id: LANDMARK_DETAILED_TEMPLATE_ID,
    family: "landmark",
    tier: "detailed",
    label: "Landmark",
    description: "Landmark cover with full market evidence page 2.",
    pages: 2,
    sourcePath: "lib/reports/templates/landmark",
    Component: LandmarkDetailedTemplate,
  },
  {
    id: HAVEN_PROPERTIES_STR_TEMPLATE_ID,
    family: "haven-properties",
    tier: "detailed",
    label: "Haven Properties",
    description: "Bespoke STR layout for Haven Properties managed delivery.",
    pages: 2,
    sourcePath: "lib/reports/templates/haven-properties",
    Component: HavenPropertiesStrTemplate,
  },
  {
    id: CLASSIC_LEASE_APPRAISAL_TEMPLATE_ID,
    family: "classic",
    tier: "detailed",
    label: "Classic",
    description: "Classic cover with weekly rent estimate; page 2 REA comparables.",
    pages: 2,
    sourcePath: "lib/reports/templates/classic",
    Component: ClassicLeaseAppraisalTemplate,
  },
  {
    id: BOLD_LEASE_APPRAISAL_TEMPLATE_ID,
    family: "bold",
    tier: "detailed",
    label: "Bold",
    description: "Bold hero layout with rent callout; page 2 REA comparables.",
    pages: 2,
    sourcePath: "lib/reports/templates/bold",
    Component: BoldLeaseAppraisalTemplate,
  },
  {
    id: GALLERY_LEASE_APPRAISAL_TEMPLATE_ID,
    family: "gallery",
    tier: "detailed",
    label: "Gallery",
    description: "Photo-forward cover with rent estimate; page 2 REA comparables.",
    pages: 2,
    sourcePath: "lib/reports/templates/gallery",
    Component: GalleryLeaseAppraisalTemplate,
  },
  {
    id: EDITORIAL_LEASE_APPRAISAL_TEMPLATE_ID,
    family: "editorial",
    tier: "detailed",
    label: "Editorial",
    description: "Magazine-style cover with rent band; page 2 REA comparables.",
    pages: 2,
    sourcePath: "lib/reports/templates/editorial",
    Component: EditorialLeaseAppraisalTemplate,
  },
  {
    id: SPLIT_LEASE_APPRAISAL_TEMPLATE_ID,
    family: "split",
    tier: "detailed",
    label: "Split",
    description: "Split photo layout with rent estimate; page 2 REA comparables.",
    pages: 2,
    sourcePath: "lib/reports/templates/split",
    Component: SplitLeaseAppraisalTemplate,
  },
  {
    id: REFINED_LEASE_APPRAISAL_TEMPLATE_ID,
    family: "refined",
    tier: "detailed",
    label: "Refined",
    description: "Refined branded layout with rent estimate; page 2 REA comparables.",
    pages: 2,
    sourcePath: "lib/reports/templates/refined",
    Component: RefinedLeaseAppraisalTemplate,
  },
  {
    id: MINIMALIST_LEASE_APPRAISAL_TEMPLATE_ID,
    family: "minimalist",
    tier: "detailed",
    label: "Minimalist",
    description: "Minimal cover with rent estimate; page 2 REA comparables.",
    pages: 2,
    sourcePath: "lib/reports/templates/minimalist",
    Component: MinimalistLeaseAppraisalTemplate,
  },
  {
    id: LANDMARK_LEASE_APPRAISAL_TEMPLATE_ID,
    family: "landmark",
    tier: "detailed",
    label: "Landmark",
    description: "Landmark-style cover with rent estimate; page 2 REA comparables.",
    pages: 2,
    sourcePath: "lib/reports/templates/landmark",
    Component: LandmarkLeaseAppraisalTemplate,
  },
  {
    id: HAVEN_PROPERTIES_LEASE_APPRAISAL_TEMPLATE_ID,
    family: "haven-properties",
    tier: "detailed",
    label: "Haven Properties",
    description: "Haven bespoke cover with rent band; page 2 REA comparables.",
    pages: 2,
    sourcePath: "lib/reports/templates/haven-properties",
    Component: HavenPropertiesLeaseAppraisalTemplate,
  },
  {
    id: BELLE_PROPERTY_STR_TEMPLATE_ID,
    family: "belle-property",
    tier: "detailed",
    label: "Belle Property Group",
    description: "Belle bespoke Bold-style STR cover; page 2 market evidence.",
    pages: 2,
    sourcePath: "lib/reports/templates/belle-property",
    Component: BellePropertyStrTemplate,
  },
  {
    id: BELLE_PROPERTY_LEASE_APPRAISAL_TEMPLATE_ID,
    family: "belle-property",
    tier: "detailed",
    label: "Belle Property Group",
    description: "Belle bespoke Bold-style lease cover; page 2 REA comparables.",
    pages: 2,
    sourcePath: "lib/reports/templates/belle-property",
    Component: BellePropertyLeaseAppraisalTemplate,
  },
];

export function getReportTemplate(id: string): ReportTemplateDefinition {
  const normalizedId = normalizeReportTemplateId(id);
  const template = REPORT_TEMPLATES.find((entry) => entry.id === normalizedId);

  if (template) {
    return template;
  }

  return REPORT_TEMPLATES.find((entry) => entry.id === DEFAULT_REPORT_TEMPLATE_ID)!;
}

export function getReportTemplatesByTier(tier: ReportTemplateDefinition["tier"]) {
  return REPORT_TEMPLATES.filter((t) => t.tier === tier);
}

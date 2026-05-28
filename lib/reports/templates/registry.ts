import { ClassicDetailedTemplate } from "@/lib/reports/templates/classic/DetailedTemplate";
import { ClassicLightTemplate } from "@/lib/reports/templates/classic/LightTemplate";
import { BoldLightTemplate, BoldDetailedTemplate } from "@/lib/reports/templates/bold/BoldTemplate";
import { GalleryLightTemplate, GalleryDetailedTemplate } from "@/lib/reports/templates/gallery/GalleryTemplate";
import { EditorialLightTemplate, EditorialDetailedTemplate } from "@/lib/reports/templates/editorial/EditorialTemplate";
import { SplitLightTemplate, SplitDetailedTemplate } from "@/lib/reports/templates/split/SplitTemplate";
import { RefinedLightTemplate, RefinedDetailedTemplate } from "@/lib/reports/templates/refined/RefinedTemplate";
import { MinimalistLightTemplate, MinimalistDetailedTemplate } from "@/lib/reports/templates/minimalist/MinimalistTemplate";
import { LandmarkLightTemplate, LandmarkDetailedTemplate } from "@/lib/reports/templates/landmark/LandmarkTemplate";
import {
  CLASSIC_DETAILED_TEMPLATE_ID,
  CLASSIC_LIGHT_TEMPLATE_ID,
  DEFAULT_REPORT_TEMPLATE_ID,
  BOLD_LIGHT_TEMPLATE_ID,
  BOLD_DETAILED_TEMPLATE_ID,
  GALLERY_LIGHT_TEMPLATE_ID,
  GALLERY_DETAILED_TEMPLATE_ID,
  EDITORIAL_LIGHT_TEMPLATE_ID,
  EDITORIAL_DETAILED_TEMPLATE_ID,
  SPLIT_LIGHT_TEMPLATE_ID,
  SPLIT_DETAILED_TEMPLATE_ID,
  REFINED_LIGHT_TEMPLATE_ID,
  REFINED_DETAILED_TEMPLATE_ID,
  MINIMALIST_LIGHT_TEMPLATE_ID,
  MINIMALIST_DETAILED_TEMPLATE_ID,
  LANDMARK_LIGHT_TEMPLATE_ID,
  LANDMARK_DETAILED_TEMPLATE_ID,
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
    id: CLASSIC_LIGHT_TEMPLATE_ID,
    family: "classic",
    tier: "light",
    label: "Classic",
    description: "Single-page sales pack with headline STR estimate.",
    pages: 1,
    sourcePath: "lib/reports/templates/classic",
    Component: ClassicLightTemplate,
  },
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
    id: BOLD_LIGHT_TEMPLATE_ID,
    family: "bold",
    tier: "light",
    label: "Bold",
    description: "Full-bleed hero overlay, stat strip, blurb and revenue on one page.",
    pages: 1,
    sourcePath: "lib/reports/templates/bold",
    Component: BoldLightTemplate,
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
    id: GALLERY_LIGHT_TEMPLATE_ID,
    family: "gallery",
    tier: "light",
    label: "Gallery",
    description: "Photo mosaic cover with address bar, revenue and agent on one page.",
    pages: 1,
    sourcePath: "lib/reports/templates/gallery",
    Component: GalleryLightTemplate,
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
    id: EDITORIAL_LIGHT_TEMPLATE_ID,
    family: "editorial",
    tier: "light",
    label: "Editorial",
    description: "Magazine-cover hero with revenue badge overlay and highlights.",
    pages: 1,
    sourcePath: "lib/reports/templates/editorial",
    Component: EditorialLightTemplate,
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
    id: SPLIT_LIGHT_TEMPLATE_ID,
    family: "split",
    tier: "light",
    label: "Split",
    description: "Content and revenue left, four-photo grid right on one page.",
    pages: 1,
    sourcePath: "lib/reports/templates/split",
    Component: SplitLightTemplate,
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
    id: REFINED_LIGHT_TEMPLATE_ID,
    family: "refined",
    tier: "light",
    label: "Refined",
    description: "Branded header, copy and revenue block with footer property photo.",
    pages: 1,
    sourcePath: "lib/reports/templates/refined",
    Component: RefinedLightTemplate,
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
    id: MINIMALIST_LIGHT_TEMPLATE_ID,
    family: "minimalist",
    tier: "light",
    label: "Minimalist",
    description: "Photo strip top half, copy and STR revenue sidebar on cream.",
    pages: 1,
    sourcePath: "lib/reports/templates/minimalist",
    Component: MinimalistLightTemplate,
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
    id: LANDMARK_LIGHT_TEMPLATE_ID,
    family: "landmark",
    tier: "light",
    label: "Landmark",
    description: "Full-bleed hero, stats banner, revenue and agents on one page.",
    pages: 1,
    sourcePath: "lib/reports/templates/landmark",
    Component: LandmarkLightTemplate,
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

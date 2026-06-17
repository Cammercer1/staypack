import { BoldBrochure } from "@/lib/collateral/templates/sales-brochure/BoldBrochure";
import { BelleBrochure } from "@/lib/collateral/templates/sales-brochure/BelleBrochure";
import { BoldBrochureOnePage } from "@/lib/collateral/templates/sales-brochure/BoldBrochureOnePage";
import { ClassicSalesBrochure } from "@/lib/collateral/templates/sales-brochure/ClassicSalesBrochure";
import { ClassicSalesBrochureOnePage } from "@/lib/collateral/templates/sales-brochure/ClassicSalesBrochureOnePage";
import { EditorialBrochure } from "@/lib/collateral/templates/sales-brochure/EditorialBrochure";
import { EditorialBrochureOnePage } from "@/lib/collateral/templates/sales-brochure/EditorialBrochureOnePage";
import { GalleryBrochure } from "@/lib/collateral/templates/sales-brochure/GalleryBrochure";
import { GalleryBrochureOnePage } from "@/lib/collateral/templates/sales-brochure/GalleryBrochureOnePage";
import { LandmarkBrochureOnePage } from "@/lib/collateral/templates/sales-brochure/LandmarkBrochureOnePage";
import { MinimalistBrochure } from "@/lib/collateral/templates/sales-brochure/MinimalistBrochure";
import { MinimalistBrochureOnePage } from "@/lib/collateral/templates/sales-brochure/MinimalistBrochureOnePage";
import { RefinedBrochure } from "@/lib/collateral/templates/sales-brochure/RefinedBrochure";
import { RefinedBrochureOnePage } from "@/lib/collateral/templates/sales-brochure/RefinedBrochureOnePage";
import { SplitBrochure } from "@/lib/collateral/templates/sales-brochure/SplitBrochure";
import { SplitBrochureOnePage } from "@/lib/collateral/templates/sales-brochure/SplitBrochureOnePage";
import {
  SALES_BROCHURE_BOLD_1PG_TEMPLATE_ID,
  SALES_BROCHURE_BOLD_2PG_TEMPLATE_ID,
  SALES_BROCHURE_BELLE_2PG_TEMPLATE_ID,
  SALES_BROCHURE_CLASSIC_1PG_TEMPLATE_ID,
  SALES_BROCHURE_CLASSIC_2PG_TEMPLATE_ID,
  SALES_BROCHURE_EDITORIAL_1PG_TEMPLATE_ID,
  SALES_BROCHURE_EDITORIAL_2PG_TEMPLATE_ID,
  SALES_BROCHURE_GALLERY_1PG_TEMPLATE_ID,
  SALES_BROCHURE_GALLERY_2PG_TEMPLATE_ID,
  SALES_BROCHURE_SPLIT_1PG_TEMPLATE_ID,
  SALES_BROCHURE_SPLIT_2PG_TEMPLATE_ID,
  SALES_BROCHURE_REFINED_1PG_TEMPLATE_ID,
  SALES_BROCHURE_REFINED_2PG_TEMPLATE_ID,
  SALES_BROCHURE_MINIMALIST_1PG_TEMPLATE_ID,
  SALES_BROCHURE_MINIMALIST_2PG_TEMPLATE_ID,
  SALES_BROCHURE_LANDMARK_1PG_TEMPLATE_ID,
} from "@/lib/collateral/templates/ids";
import type { CollateralTemplateDefinition } from "@/lib/collateral/templates/types";

export const SALES_BROCHURE_TEMPLATES: CollateralTemplateDefinition[] = [
  {
    id: SALES_BROCHURE_GALLERY_1PG_TEMPLATE_ID,
    collateralType: "sales_brochure",
    label: "Gallery",
    description:
      "Hero plus three supporting photos, address bar, blurb and agent; website & QR footer.",
    pageFormat: "a4-portrait",
    pages: 1,
    Component: GalleryBrochureOnePage,
  },
  {
    id: SALES_BROCHURE_GALLERY_2PG_TEMPLATE_ID,
    collateralType: "sales_brochure",
    label: "Gallery",
    description: "Ray White–style cover page; page 2 full photo grid with agent bar.",
    pageFormat: "a4-portrait",
    pages: 2,
    Component: GalleryBrochure,
  },
  {
    id: SALES_BROCHURE_CLASSIC_1PG_TEMPLATE_ID,
    collateralType: "sales_brochure",
    label: "Classic",
    description: "Header, hero gallery, property copy and agent footer on one page.",
    pageFormat: "a4-portrait",
    pages: 1,
    Component: ClassicSalesBrochureOnePage,
  },
  {
    id: SALES_BROCHURE_EDITORIAL_1PG_TEMPLATE_ID,
    collateralType: "sales_brochure",
    label: "Editorial",
    description:
      "Magazine cover: full-bleed hero, overlay address and price, numbered highlights.",
    pageFormat: "a4-portrait",
    pages: 1,
    Component: EditorialBrochureOnePage,
  },
  {
    id: SALES_BROCHURE_SPLIT_1PG_TEMPLATE_ID,
    collateralType: "sales_brochure",
    label: "Split",
    description:
      "Open-home layout: copy and agent left, four-photo grid right.",
    pageFormat: "a4-portrait",
    pages: 1,
    Component: SplitBrochureOnePage,
  },
  {
    id: SALES_BROCHURE_BOLD_1PG_TEMPLATE_ID,
    collateralType: "sales_brochure",
    label: "Bold",
    description:
      "Branded header band, photo strip, features with agent column and footer bar.",
    pageFormat: "a4-portrait",
    pages: 1,
    Component: BoldBrochureOnePage,
  },
  {
    id: SALES_BROCHURE_REFINED_1PG_TEMPLATE_ID,
    collateralType: "sales_brochure",
    label: "Refined",
    description:
      "Introducing header, copy and features with side visual, full-width footer photo.",
    pageFormat: "a4-portrait",
    pages: 1,
    Component: RefinedBrochureOnePage,
  },
  {
    id: SALES_BROCHURE_MINIMALIST_1PG_TEMPLATE_ID,
    collateralType: "sales_brochure",
    label: "Minimalist",
    description:
      "Hero plus three photos; copy left, sale/view/agent sidebar right on cream.",
    pageFormat: "a4-portrait",
    pages: 1,
    Component: MinimalistBrochureOnePage,
  },
  {
    id: SALES_BROCHURE_LANDMARK_1PG_TEMPLATE_ID,
    collateralType: "sales_brochure",
    label: "Landmark",
    description:
      "Full-bleed hero, branded stats banner, copy left with price/agents/photos right.",
    pageFormat: "a4-portrait",
    pages: 1,
    Component: LandmarkBrochureOnePage,
  },
  {
    id: SALES_BROCHURE_CLASSIC_2PG_TEMPLATE_ID,
    collateralType: "sales_brochure",
    label: "Classic",
    description: "Two-page layout with hero gallery, copy, photo grid and highlights.",
    pageFormat: "a4-portrait",
    pages: 2,
    Component: ClassicSalesBrochure,
  },
  {
    id: SALES_BROCHURE_EDITORIAL_2PG_TEMPLATE_ID,
    collateralType: "sales_brochure",
    label: "Editorial",
    description:
      "Cover spread with asymmetric photos; inside spread with mosaic and numbered features.",
    pageFormat: "a4-portrait",
    pages: 2,
    Component: EditorialBrochure,
  },
  {
    id: SALES_BROCHURE_SPLIT_2PG_TEMPLATE_ID,
    collateralType: "sales_brochure",
    label: "Split",
    description:
      "Page 1 open-home split; page 2 extra gallery and highlights.",
    pageFormat: "a4-portrait",
    pages: 2,
    Component: SplitBrochure,
  },
  {
    id: SALES_BROCHURE_BOLD_2PG_TEMPLATE_ID,
    collateralType: "sales_brochure",
    label: "Bold",
    description: "Commercial-style page 1; accent highlights and gallery page 2.",
    pageFormat: "a4-portrait",
    pages: 2,
    Component: BoldBrochure,
  },
  {
    id: SALES_BROCHURE_BELLE_2PG_TEMPLATE_ID,
    collateralType: "sales_brochure",
    label: "Belle Property Group",
    description: "Belle bespoke Bold-style page 1; photo gallery page 2.",
    pageFormat: "a4-portrait",
    pages: 2,
    Component: BelleBrochure,
  },
  {
    id: SALES_BROCHURE_REFINED_2PG_TEMPLATE_ID,
    collateralType: "sales_brochure",
    label: "Refined",
    description:
      "Page 1 property overview; page 2 photo mosaic and agent bar.",
    pageFormat: "a4-portrait",
    pages: 2,
    Component: RefinedBrochure,
  },
  {
    id: SALES_BROCHURE_MINIMALIST_2PG_TEMPLATE_ID,
    collateralType: "sales_brochure",
    label: "Minimalist",
    description:
      "LJ Hooker–style cover with photo strip and sidebar; page 2 features with photo stack.",
    pageFormat: "a4-portrait",
    pages: 2,
    Component: MinimalistBrochure,
  },
];

export function getSalesBrochureTemplatesByPageCount(pages: 1 | 2) {
  return SALES_BROCHURE_TEMPLATES.filter((template) => template.pages === pages);
}

"use client";

import { useMemo } from "react";
import { BrandFontLoader } from "@/components/settings/BrandFontLoader";
import {
  getCollateralPageFormat,
  getCollateralPageFormatStyle,
  getSocialPostPageFormat,
} from "@/lib/collateral/pageFormat";
import {
  normalizeBusinessCardVariantId,
  type BusinessCardVariantId,
} from "@/lib/collateral/business-card/formats";
import {
  getDefaultSocialPostVariantId,
  normalizeSocialPostVariantId,
} from "@/lib/collateral/social/formats";
import { coerceSalesBrochureDocument } from "@/lib/collateral/sales-brochure/coerceBrochureDocument";
import { coerceSalesBrochureCopyForEditor } from "@/lib/collateral/sales-brochure/propertyHighlights";
import { salesBrochureToReportShape } from "@/lib/collateral/sales-brochure/toReportShape";
import {
  isBrochureDocument,
  isSocialPostsDocument,
  isBusinessCardDocument,
} from "@/lib/collateral/templates/types";
import {
  getReportBrandAdvancedVars,
  getReportBrandColourVars,
  getReportBrandColours,
  getReportBrandLogoVars,
} from "@/lib/reports/brandColours";
import { getBrandLogoCssVars } from "@/lib/branding/logos";
import { getReportFontConfig } from "@/lib/reports/reportFonts";
import {
  getReportPageFormat,
  getReportPageFormatStyle,
} from "@/lib/reports/pageFormat";
import { getCollateralTemplate } from "@/lib/collateral/templates/registry";
import { resolveTemplateIdFromDocument } from "@/lib/collateral/templates/resolveTemplateId";
import {
  getBrandAdvancedCssVars,
  resolveBrandAdvanced,
} from "@/lib/branding/advanced";
import {
  resolveBodyFontFamily,
  resolveHeadingFontFamily,
} from "@/lib/branding/google-fonts";
import { BrochureImageMetaProvider } from "@/components/collateral/sales-brochure/inline/BrochureImageMetaContext";
import { useEditableContext } from "@/components/collateral/sales-brochure/inline/EditableContext";
import type { CollateralDocumentJson } from "@/lib/collateral/templates/types";
import type { ReportPageVariant } from "@/lib/reports/templates/shared/reportPageVariant";
import type { CollateralType, FinalReportJson } from "@/lib/types";

export function CollateralPreview({
  document,
  collateralType,
  printMode = false,
  variantId,
  metricsReport,
  reportVariant,
  allowDevBlurbLengthMap = false,
}: {
  document: CollateralDocumentJson;
  collateralType: CollateralType;
  printMode?: boolean;
  variantId?: string;
  metricsReport?: FinalReportJson;
  reportVariant?: ReportPageVariant;
  allowDevBlurbLengthMap?: boolean;
}) {
  const { showFullBlurb } = useEditableContext();

  const previewDocument = useMemo(() => {
    if (
      (collateralType === "sales_brochure" || collateralType === "rental_brochure") &&
      isBrochureDocument(document)
    ) {
      if (showFullBlurb) {
        return {
          ...document,
          copy: coerceSalesBrochureCopyForEditor(document.copy),
        };
      }
      return coerceSalesBrochureDocument(document, { allowDevBlurbLengthMap });
    }
    return document;
  }, [allowDevBlurbLengthMap, collateralType, document, showFullBlurb]);

  const templateId = resolveTemplateIdFromDocument(previewDocument, collateralType);
  const template = getCollateralTemplate(templateId);
  const Template = template.Component;

  const socialVariantId = isSocialPostsDocument(previewDocument)
    ? variantId
      ? normalizeSocialPostVariantId(variantId)
      : normalizeSocialPostVariantId(previewDocument.active_variant_id)
    : null;
  const businessCardVariantId =
    isBusinessCardDocument(previewDocument) && (variantId === "front" || variantId === "back")
      ? (normalizeBusinessCardVariantId(variantId) as BusinessCardVariantId)
      : null;

  const pageFormat =
    socialVariantId != null
      ? getSocialPostPageFormat(socialVariantId)
      : getCollateralPageFormat(template.pageFormat);
  const agency = previewDocument.agency;

  const headingFontId = agency.heading_font_family || agency.font_family || "fraunces";
  const bodyFontId = agency.body_font_family || agency.font_family || "inter";
  const headingFontFileUrl = agency.heading_font_file_url || null;
  const bodyFontFileUrl = agency.body_font_file_url || agency.font_file_url || null;

  const headingFontFamily = resolveHeadingFontFamily(
    headingFontId,
    headingFontFileUrl,
  );
  const bodyFontFamily = resolveBodyFontFamily(bodyFontId, bodyFontFileUrl);
  const brandAdvanced = resolveBrandAdvanced({
    primary_colour: agency.primary_colour,
    text_colour: agency.text_colour,
    brand_advanced_json: agency.brand_advanced ?? null,
  });

  const salesBrochureReport = isBrochureDocument(previewDocument)
    ? salesBrochureToReportShape(previewDocument)
    : null;
  const reportBrand = salesBrochureReport
    ? getReportBrandColours(salesBrochureReport.agency)
    : null;
  const reportFonts = salesBrochureReport
    ? getReportFontConfig(salesBrochureReport.agency)
    : null;

  return (
    <div
      className={printMode ? "collateral-preview print-mode" : "collateral-preview"}
      data-collateral-root
      style={{
        ...getCollateralPageFormatStyle(pageFormat),
        ...(salesBrochureReport
          ? getReportPageFormatStyle(getReportPageFormat("portrait"))
          : {}),
        ["--collateral-heading-font" as string]: headingFontFamily,
        ["--collateral-body-font" as string]: bodyFontFamily,
        ["--collateral-primary" as string]: agency.primary_colour,
        ["--collateral-text" as string]: agency.text_colour || "#1a1a1a",
        ...(reportBrand ? getReportBrandColourVars(reportBrand) : {}),
        ...(salesBrochureReport
          ? getReportBrandLogoVars(salesBrochureReport.agency)
          : getBrandLogoCssVars(agency)),
        ...(salesBrochureReport
          ? getReportBrandAdvancedVars(salesBrochureReport.agency)
          : getBrandAdvancedCssVars(brandAdvanced)),
        ...(reportFonts
          ? {
              ["--report-heading-font" as string]: reportFonts.headingFontFamily,
              ["--report-body-font" as string]: reportFonts.bodyFontFamily,
            }
          : {}),
      }}
    >
      <BrandFontLoader
        fonts={{
          heading_font_family: headingFontId,
          body_font_family: bodyFontId,
          heading_font_file_url: headingFontFileUrl,
          body_font_file_url: bodyFontFileUrl,
        }}
      />
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .collateral-preview[data-collateral-root] {
              font-family: ${bodyFontFamily};
            }
            .collateral-preview[data-collateral-root] h1,
            .collateral-preview[data-collateral-root] h2,
            .collateral-preview[data-collateral-root] h3 {
              font-family: ${headingFontFamily};
            }
            .collateral-preview.print-mode .collateral-page {
              box-shadow: none;
              page-break-after: always;
            }
            .collateral-preview.print-mode .collateral-page:last-child {
              page-break-after: avoid;
            }
            .collateral-preview.print-mode .report-page {
              page-break-after: always;
              box-shadow: none;
            }
            .collateral-preview.print-mode .report-page:last-child {
              page-break-after: avoid;
            }
            @media print {
              @page {
                size: ${pageFormat.width} ${pageFormat.height};
                margin: 0;
              }
              body {
                margin: 0;
              }
            }
          `,
        }}
      />
      {isBrochureDocument(previewDocument) ? (
        <BrochureImageMetaProvider meta={previewDocument.listing_image_meta}>
          <Template
            document={previewDocument}
            metricsReport={metricsReport}
            reportVariant={reportVariant}
            {...(socialVariantId
              ? { variantId: socialVariantId }
              : businessCardVariantId
                ? { variantId: businessCardVariantId }
                : collateralType === "social_posts"
                  ? { variantId: getDefaultSocialPostVariantId() }
                  : {})}
          />
        </BrochureImageMetaProvider>
      ) : (
        <Template
          document={previewDocument}
          metricsReport={metricsReport}
          reportVariant={reportVariant}
          {...(socialVariantId
            ? { variantId: socialVariantId }
            : businessCardVariantId
              ? { variantId: businessCardVariantId }
              : collateralType === "social_posts"
                ? { variantId: getDefaultSocialPostVariantId() }
                : {})}
        />
      )}
    </div>
  );
}

"use client";

import { BrandFontLoader } from "@/components/settings/BrandFontLoader";
import {
  getCollateralPageFormat,
  getCollateralPageFormatStyle,
} from "@/lib/collateral/pageFormat";
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
import type { CollateralDocumentJson } from "@/lib/collateral/templates/types";
import type { CollateralType } from "@/lib/types";

export function CollateralPreview({
  document,
  collateralType,
  printMode = false,
}: {
  document: CollateralDocumentJson;
  collateralType: CollateralType;
  printMode?: boolean;
}) {
  const templateId = resolveTemplateIdFromDocument(document, collateralType);
  const template = getCollateralTemplate(templateId);
  const Template = template.Component;
  const pageFormat = getCollateralPageFormat(template.pageFormat);
  const agency = document.agency;

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

  return (
    <div
      className={printMode ? "collateral-preview print-mode" : "collateral-preview"}
      data-collateral-root
      style={{
        ...getCollateralPageFormatStyle(pageFormat),
        ["--collateral-heading-font" as string]: headingFontFamily,
        ["--collateral-body-font" as string]: bodyFontFamily,
        ["--collateral-primary" as string]: agency.primary_colour,
        ["--collateral-text" as string]: agency.text_colour || "#1a1a1a",
        ...getBrandAdvancedCssVars(brandAdvanced),
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
      <Template document={document} />
    </div>
  );
}

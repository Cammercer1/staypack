import { getCollateralPageFormat } from "@/lib/collateral/pageFormat";
import type { CollateralTemplateProps } from "@/lib/collateral/templates/types";
import { isBrochureDocument } from "@/lib/collateral/templates/types";
import { LandmarkSpread } from "@/lib/collateral/templates/sales-brochure/landmark/LandmarkLayout";
import { BrochurePageShell } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePageShell";
import { useBrochurePage } from "@/lib/collateral/templates/sales-brochure/shared/useBrochurePage";

/** Landmark · 1 page — hero, branded stats banner, copy left + price/agents right. */
export function LandmarkBrochureOnePage({ document, pageFormat = "a4-portrait" }: CollateralTemplateProps) {
  if (!isBrochureDocument(document)) return null;

  const { report, brand } = useBrochurePage(document);
  const fmt = getCollateralPageFormat(pageFormat);

  return (
    <div
      className="sales-brochure-preview flex flex-col"
      style={{
        ["--report-page-width" as string]: fmt.width,
        ["--report-page-height" as string]: fmt.height,
      }}
    >
      <BrochurePageShell brand={brand}>
        <LandmarkSpread document={document} report={report} />
      </BrochurePageShell>
    </div>
  );
}

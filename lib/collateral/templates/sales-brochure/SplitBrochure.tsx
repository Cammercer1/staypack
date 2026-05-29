import { getCollateralPageFormat } from "@/lib/collateral/pageFormat";
import type { CollateralTemplateProps } from "@/lib/collateral/templates/types";
import { isSalesBrochureDocument } from "@/lib/collateral/templates/types";
import { SplitSpreadLayout } from "@/lib/collateral/templates/sales-brochure/split/SplitLayout";
import { BrochureGalleryPage } from "@/lib/collateral/templates/sales-brochure/shared/BrochureGalleryPage";
import { BrochurePageShell } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePageShell";
import { useBrochurePage } from "@/lib/collateral/templates/sales-brochure/shared/useBrochurePage";

/** Split · 2 pages — page 1 open-home split; page 2 standardised gallery + optional note + contact/QR. */
export function SplitBrochure({ document, pageFormat = "a4-portrait" }: CollateralTemplateProps) {
  if (!isSalesBrochureDocument(document)) return null;

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
        <SplitSpreadLayout document={document} report={report} />
      </BrochurePageShell>

      <BrochurePageShell brand={brand}>
        <div className="flex flex-col overflow-hidden" style={{ height: fmt.height }}>
          <BrochureGalleryPage document={document} report={report} />
        </div>
      </BrochurePageShell>
    </div>
  );
}

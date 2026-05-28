import type { CollateralDocumentJson } from "@/lib/collateral/templates/types";
import { isSalesBrochureDocument } from "@/lib/collateral/templates/types";
import { RefinedSpread } from "@/lib/collateral/templates/sales-brochure/refined/RefinedLayout";
import { BrochurePageShell } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePageShell";
import { useBrochurePage } from "@/lib/collateral/templates/sales-brochure/shared/useBrochurePage";

/** Refined · 1 page — introducing header, copy + visual, footer hero image. */
export function RefinedBrochureOnePage({ document }: { document: CollateralDocumentJson }) {
  if (!isSalesBrochureDocument(document)) return null;

  const { report, brand } = useBrochurePage(document);

  return (
    <div
      className="sales-brochure-preview flex flex-col"
      style={{
        ["--report-page-width" as string]: "210mm",
        ["--report-page-height" as string]: "297mm",
      }}
    >
      <BrochurePageShell brand={brand}>
        <div className="flex min-h-[297mm] flex-col overflow-hidden">
          <RefinedSpread document={document} report={report} />
        </div>
      </BrochurePageShell>
    </div>
  );
}

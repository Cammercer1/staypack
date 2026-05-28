import type { CollateralDocumentJson } from "@/lib/collateral/templates/types";
import { isSalesBrochureDocument } from "@/lib/collateral/templates/types";
import { SplitSpreadLayout } from "@/lib/collateral/templates/sales-brochure/split/SplitLayout";
import { BrochurePageShell } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePageShell";
import { useBrochurePage } from "@/lib/collateral/templates/sales-brochure/shared/useBrochurePage";

/** Split · 1 page — content left, photo grid right (open-home brochure). */
export function SplitBrochureOnePage({ document }: { document: CollateralDocumentJson }) {
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
      <BrochurePageShell brand={brand} className="!shadow-sm">
        <SplitSpreadLayout document={document} report={report} />
      </BrochurePageShell>
    </div>
  );
}

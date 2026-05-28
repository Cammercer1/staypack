import type { CollateralDocumentJson } from "@/lib/collateral/templates/types";
import { isSalesBrochureDocument } from "@/lib/collateral/templates/types";
import { BoldPageOneSpread } from "@/lib/collateral/templates/sales-brochure/bold/BoldLayout";
import { BrochurePageShell } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePageShell";
import { useBrochurePage } from "@/lib/collateral/templates/sales-brochure/shared/useBrochurePage";

/** Bold · 1 page — branded header, photo strip, features + agents, footer band. */
export function BoldBrochureOnePage({ document }: { document: CollateralDocumentJson }) {
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
        <div className="flex h-[297mm] flex-col overflow-hidden">
          <BoldPageOneSpread document={document} report={report} />
        </div>
      </BrochurePageShell>
    </div>
  );
}

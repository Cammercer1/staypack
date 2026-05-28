import type { CollateralDocumentJson } from "@/lib/collateral/templates/types";
import { isSalesBrochureDocument } from "@/lib/collateral/templates/types";
import {
  MinimalistPageOne,
  MinimalistPageTwo,
} from "@/lib/collateral/templates/sales-brochure/minimalist/MinimalistLayout";
import { BrochurePageShell } from "@/lib/collateral/templates/sales-brochure/shared/BrochurePageShell";
import { useBrochurePage } from "@/lib/collateral/templates/sales-brochure/shared/useBrochurePage";

/** Minimalist · 2 pages — hero cover; features sidebar with photo stack page 2. */
export function MinimalistBrochure({ document }: { document: CollateralDocumentJson }) {
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
        <MinimalistPageOne
          document={document}
          report={report}
          blurbParagraphLimit={3}
        />
      </BrochurePageShell>

      <BrochurePageShell brand={brand}>
        <MinimalistPageTwo document={document} report={report} />
      </BrochurePageShell>
    </div>
  );
}

import type { CollateralDocumentJson } from "@/lib/collateral/templates/types";
import { isSalesBrochureDocument } from "@/lib/collateral/templates/types";
import { ClassicSalesBrochurePageOne } from "@/lib/collateral/templates/sales-brochure/ClassicSalesBrochurePageOne";
import { ClassicSalesBrochurePageTwo } from "@/lib/collateral/templates/sales-brochure/ClassicSalesBrochurePageTwo";

type Props = {
  document: CollateralDocumentJson;
};

export function ClassicSalesBrochure({ document }: Props) {
  if (!isSalesBrochureDocument(document)) {
    return null;
  }

  return (
    <div
      className="sales-brochure-preview flex flex-col gap-0"
      style={{
        ["--report-page-width" as string]: "210mm",
        ["--report-page-height" as string]: "297mm",
      }}
    >
      <ClassicSalesBrochurePageOne document={document} />
      <ClassicSalesBrochurePageTwo document={document} />
    </div>
  );
}

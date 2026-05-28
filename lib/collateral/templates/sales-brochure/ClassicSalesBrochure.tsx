import { getCollateralPageFormat } from "@/lib/collateral/pageFormat";
import type { CollateralTemplateProps } from "@/lib/collateral/templates/types";
import { isSalesBrochureDocument } from "@/lib/collateral/templates/types";
import { ClassicSalesBrochurePageOne } from "@/lib/collateral/templates/sales-brochure/ClassicSalesBrochurePageOne";
import { ClassicSalesBrochurePageTwo } from "@/lib/collateral/templates/sales-brochure/ClassicSalesBrochurePageTwo";

export function ClassicSalesBrochure({ document, pageFormat = "a4-portrait" }: CollateralTemplateProps) {
  if (!isSalesBrochureDocument(document)) {
    return null;
  }

  const fmt = getCollateralPageFormat(pageFormat);

  return (
    <div
      className="sales-brochure-preview flex flex-col gap-0"
      style={{
        ["--report-page-width" as string]: fmt.width,
        ["--report-page-height" as string]: fmt.height,
      }}
    >
      <ClassicSalesBrochurePageOne document={document} />
      <ClassicSalesBrochurePageTwo document={document} />
    </div>
  );
}

import type { ReactNode } from "react";
import type { ReportBrandColours } from "@/lib/reports/brandColours";
import { BROCHURE_PAGE_STYLE } from "@/lib/collateral/templates/sales-brochure/shared/useBrochurePage";

export function BrochurePageShell({
  brand,
  children,
  className = "",
}: {
  brand: ReportBrandColours;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`report-page mx-auto flex flex-col overflow-hidden shadow-sm ${className}`}
      style={{
        backgroundColor: brand.pageBackground,
        color: brand.text,
        ...BROCHURE_PAGE_STYLE,
      }}
    >
      {children}
    </section>
  );
}

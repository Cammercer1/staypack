import { BoldReportPageOne } from "@/lib/reports/templates/bold/BoldTemplate";
import { HavenPageTwo } from "@/lib/reports/templates/haven-properties/HavenPageTwo";
import {
  applyHavenBrandToReport,
  HAVEN_AGENT_PHOTO_CLASS,
  HAVEN_BRAND,
} from "@/lib/reports/templates/haven-properties/brand";
import type { ReportTemplateProps } from "@/lib/reports/templates/types";

/**
 * havenly property STR — Bold detailed layout + hardcoded brand in brand.ts.
 */
export function HavenPropertiesStrTemplate({ report }: ReportTemplateProps) {
  const branded = applyHavenBrandToReport(report);

  return (
    <>
      <BoldReportPageOne
        report={branded}
        options={{
          logoUrl: HAVEN_BRAND.logoOnDarkUrl,
          footerLogoClassName: "h-7 max-w-[160px] object-contain",
          accentColor: HAVEN_BRAND.statBar,
          heroOverlayEnhanced: true,
          revenueOnAccent: true,
          heroSubheadline: HAVEN_BRAND.heroSubheadline,
          agentPhotoClassName: HAVEN_AGENT_PHOTO_CLASS,
        }}
      />
      <HavenPageTwo report={branded} />
    </>
  );
}

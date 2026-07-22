import { describe, expect, it } from "vitest";
import {
  buildPublishedPdfFilename,
  resolveCollateralDownloadType,
  resolveReportDownloadType,
} from "@/lib/reports/downloadFilename";

describe("published PDF filenames", () => {
  it("orders the address, report type and brand name", () => {
    expect(
      buildPublishedPdfFilename({
        address: "20 Joy Street, Encounter Bay SA 5211",
        reportType: "rental-appraisal",
        brandName: "OC Real Estate",
      }),
    ).toBe(
      "20-joy-street-encounter-bay-sa-5211-rental-appraisal-oc-real-estate.pdf",
    );
  });

  it("provides safe fallbacks when listing or agency labels are absent", () => {
    expect(
      buildPublishedPdfFilename({
        address: null,
        reportType: "",
        brandName: null,
      }),
    ).toBe("property-report-agency.pdf");
  });

  it("uses agent-facing names for report templates", () => {
    expect(resolveReportDownloadType("oc-sales-appraisal-v1")).toBe(
      "sales-appraisal",
    );
    expect(resolveReportDownloadType("oc-lease-appraisal-v1")).toBe(
      "rental-appraisal",
    );
    expect(resolveReportDownloadType("oc-str-v1")).toBe(
      "short-term-rental-appraisal",
    );
  });

  it("names collateral types consistently", () => {
    expect(resolveCollateralDownloadType("sales_brochure")).toBe(
      "sales-brochure",
    );
    expect(resolveCollateralDownloadType("investor_snapshot")).toBe(
      "investor-snapshot",
    );
  });
});

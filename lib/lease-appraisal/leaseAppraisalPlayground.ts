import havenFernyFixture from "@/lib/lease-appraisal/fixtures/haven-ferny-lease-appraisal.json";
import { applyHavenLeaseAppraisalBrandToReport } from "@/lib/reports/templates/haven-properties/brand";
import { HAVEN_PROPERTIES_LEASE_APPRAISAL_TEMPLATE_ID } from "@/lib/reports/templates/ids";
import type { FinalReportJson } from "@/lib/types";

export function getLeaseAppraisalPlaygroundReport(): FinalReportJson {
  const base = havenFernyFixture as FinalReportJson;

  return applyHavenLeaseAppraisalBrandToReport({
    ...base,
    template_id: HAVEN_PROPERTIES_LEASE_APPRAISAL_TEMPLATE_ID,
  });
}

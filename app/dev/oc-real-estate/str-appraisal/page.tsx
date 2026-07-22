import { notFound } from "next/navigation";
import { OcStrAppraisalWorkshop } from "@/components/dev/OcStrAppraisalWorkshop";
import { loadDevPlaygroundReportOptional } from "@/lib/dev/loadDevPlaygroundReport";
import { loadPlaygroundReportOptional } from "@/lib/reports/loadPlaygroundReport";

const OC_LISTING_ID = "142f544a-891c-4e8e-a9e6-bf5b3303388a";
const OC_STR_REPORT_ID = "5eaae4fb-a503-4ee7-951a-97171dd34a4e";

export default async function DevOcStrAppraisalPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const bundle =
    (await loadPlaygroundReportOptional(OC_STR_REPORT_ID)) ??
    (await loadDevPlaygroundReportOptional(OC_STR_REPORT_ID));

  if (!bundle || bundle.listing.id !== OC_LISTING_ID) {
    notFound();
  }

  return (
    <OcStrAppraisalWorkshop
      listing={bundle.listing}
      report={bundle.report}
      agency={bundle.agency}
      baseReport={bundle.finalReport}
    />
  );
}

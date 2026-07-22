import { notFound } from "next/navigation";
import { OcSalesAppraisalWorkshop } from "@/components/dev/OcSalesAppraisalWorkshop";
import { loadDevPlaygroundReportOptional } from "@/lib/dev/loadDevPlaygroundReport";
import { loadPlaygroundReportOptional } from "@/lib/reports/loadPlaygroundReport";

const OC_LISTING_ID = "142f544a-891c-4e8e-a9e6-bf5b3303388a";
const OC_REPORT_ID = "0cf51bcd-723b-487e-8441-bd1b63425433";

export default async function DevOcSalesAppraisalPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const bundle =
    (await loadPlaygroundReportOptional(OC_REPORT_ID)) ??
    (await loadDevPlaygroundReportOptional(OC_REPORT_ID));

  if (!bundle || bundle.listing.id !== OC_LISTING_ID) {
    notFound();
  }

  return (
    <OcSalesAppraisalWorkshop
      listing={bundle.listing}
      report={bundle.report}
      agency={bundle.agency}
      baseReport={bundle.finalReport}
    />
  );
}

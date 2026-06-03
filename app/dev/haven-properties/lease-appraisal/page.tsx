import { notFound } from "next/navigation";
import { HavenLeaseAppraisalPlayground } from "@/components/dev/HavenLeaseAppraisalPlayground";
import { getLeaseAppraisalPlaygroundReport } from "@/lib/lease-appraisal/leaseAppraisalPlayground";

export default function DevHavenLeaseAppraisalPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const baseReport = getLeaseAppraisalPlaygroundReport();

  return <HavenLeaseAppraisalPlayground baseReport={baseReport} />;
}

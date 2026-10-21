"use client";

import { useState } from "react";
import type { TemplatesResponse } from "@/components/templates/useAvailableTemplates";
import { ReportWizard } from "@/components/reports/ReportWizard";
import { AppraisalArchiveControl } from "@/components/str-appraisals/AppraisalArchiveControl";
import { AppraisalCustomerPanel } from "@/components/str-appraisals/AppraisalCustomerPanel";
import type { StrAppraisal } from "@/lib/str-appraisals/types";
import type { Agency, Listing, Report } from "@/lib/types";

type Props = {
  calculatorReview?: boolean;
  initialListing: Listing;
  initialReport: Report;
  hasPublishedProposal?: boolean;
  agency: Agency;
  appraisal?: StrAppraisal;
  availableTemplates?: TemplatesResponse;
};

export function ReportEditor({ initialListing, initialReport, hasPublishedProposal, agency, availableTemplates, appraisal, calculatorReview }: Props) {
  const [currentAppraisal, setAppraisal] = useState(appraisal);
  const [customerEditing, setCustomerEditing] = useState(false);
  const [listing, setListing] = useState(initialListing);
  const [report, setReport] = useState(initialReport);

  return (
    <ReportWizard
      calculatorReview={calculatorReview}
      initialListing={listing}
      initialReport={report}
      hasPublishedProposal={hasPublishedProposal}
      agency={agency}
      availableTemplates={availableTemplates}
      digitalProposal={Boolean(appraisal)}
      customerRevision={currentAppraisal?.updated_at}
      customerEditing={customerEditing}
      appraisalActions={appraisal ? <AppraisalArchiveControl reportId={appraisal.report_id} /> : undefined}
      customerPanel={appraisal ? <AppraisalCustomerPanel key={currentAppraisal?.updated_at} initialAppraisal={currentAppraisal ?? appraisal} onSaved={setAppraisal} archived={false} layout="inline" onEditingChange={setCustomerEditing} /> : undefined}
      onListingChange={setListing}
      onReportChange={setReport}
    />
  );
}

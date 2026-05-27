"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrapedListingReviewStep } from "@/components/reports/ScrapedListingReviewStep";
import { StrEstimateStep } from "@/components/reports/StrEstimateStep";
import { GeneratedCopyEditor } from "@/components/reports/GeneratedCopyEditor";
import { ReportPreview } from "@/components/reports/ReportPreview";
import type { Agency, FinalReportJson, Report } from "@/lib/types";

const steps = [
  { id: "review", label: "Review listing" },
  { id: "estimate", label: "STR estimate" },
  { id: "copy", label: "Generate copy" },
  { id: "preview", label: "Preview & publish" },
];

export function ReportWizard({
  initialReport,
  agency,
}: {
  initialReport: Report;
  agency: Agency;
}) {
  const [report, setReport] = useState(initialReport);
  const [step, setStep] = useState(getInitialStep(initialReport));
  const [manualEntry, setManualEntry] = useState(!initialReport.scraped_listing_json);
  const [loading, setLoading] = useState(false);

  const finalReport = useMemo(
    () => report.final_report_json as FinalReportJson | null,
    [report.final_report_json],
  );

  async function publishReport() {
    setLoading(true);
    const publishResponse = await fetch(`/api/reports/${report.id}/publish`, {
      method: "POST",
    });
    const publishPayload = await publishResponse.json();

    if (!publishResponse.ok) {
      toast.error(publishPayload.error ?? "Publish failed");
      setLoading(false);
      return;
    }

    const pdfResponse = await fetch(`/api/reports/${report.id}/generate-pdf`, {
      method: "POST",
    });
    const pdfPayload = await pdfResponse.json();

    if (!pdfResponse.ok) {
      toast.error(pdfPayload.error ?? "PDF generation failed");
      setLoading(false);
      return;
    }

    setReport(pdfPayload.report);
    toast.success("Report published");
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <Tabs value={step} onValueChange={setStep}>
        <TabsList className="grid w-full grid-cols-4">
          {steps.map((item) => (
            <TabsTrigger key={item.id} value={item.id}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="review">
          <ScrapedListingReviewStep
            report={report}
            manualMode={manualEntry}
            onSaved={(nextReport) => {
              setReport(nextReport);
              setStep("estimate");
            }}
          />
        </TabsContent>

        <TabsContent value="estimate">
          <StrEstimateStep
            report={report}
            onComplete={(nextReport) => {
              setReport(nextReport);
              setStep("copy");
            }}
          />
        </TabsContent>

        <TabsContent value="copy">
          <GeneratedCopyEditor
            agency={agency}
            report={report}
            onComplete={(nextReport) => {
              setReport(nextReport);
            }}
            onContinueToPreview={() => setStep("preview")}
          />
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          {finalReport ? <ReportPreview report={finalReport} /> : (
            <p className="text-sm text-muted-foreground">
              Generate copy first to preview the report.
            </p>
          )}
          <div className="flex flex-wrap gap-3 no-print">
            <Button variant="outline" disabled={loading}>
              Save draft
            </Button>
            <Button variant="outline" disabled={loading || !finalReport}>
              Generate PDF preview
            </Button>
            <Button onClick={publishReport} disabled={loading || !finalReport}>
              {loading ? "Publishing..." : "Publish report"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function getInitialStep(report: Report) {
  if (report.status === "published" || report.status === "generated") {
    return "preview";
  }
  if (report.status === "estimated") {
    return "copy";
  }
  return "review";
}

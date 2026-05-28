"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AsyncLoadingOverlay } from "@/components/ui/async-loading-overlay";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { StrEstimateStep } from "@/components/reports/StrEstimateStep";
import { GeneratedCopyEditor } from "@/components/reports/GeneratedCopyEditor";
import { DownloadPdfButton } from "@/components/reports/DownloadPdfButton";
import { FittedReportPreview } from "@/components/reports/FittedReportPreview";
import { mergeAgencyBrandIntoFinalReport } from "@/lib/reports/mergeAgencyBrand";
import { enrichFinalReportMetrics } from "@/lib/reports/enrichFinalReportMetrics";
import type { Agency, AgentProfile, FinalReportJson, Listing, Report } from "@/lib/types";

const steps = [
  { id: "estimate", label: "STR estimate" },
  { id: "copy", label: "Generate copy" },
  { id: "preview", label: "Preview & publish" },
];

export function ReportWizard({
  initialListing,
  initialReport,
  agency,
  onListingChange,
  onReportChange,
}: {
  initialListing: Listing;
  initialReport: Report;
  agency: Agency;
  onListingChange?: (listing: Listing) => void;
  onReportChange?: (report: Report) => void;
}) {
  const [listing, setListing] = useState(initialListing);
  const [report, setReport] = useState(initialReport);
  const [brandAgency, setBrandAgency] = useState(agency);
  const [step, setStep] = useState(getInitialStep(initialReport));
  const [loading, setLoading] = useState(false);
  const [publishStage, setPublishStage] = useState<
    "idle" | "publishing" | "generating-pdf"
  >("idle");
  const [agencyAgents, setAgencyAgents] = useState<AgentProfile[]>([]);

  function updateListing(nextListing: Listing) {
    setListing(nextListing);
    onListingChange?.(nextListing);
  }

  function updateReport(nextReport: Report) {
    setReport(nextReport);
    onReportChange?.(nextReport);
  }

  useEffect(() => {
    fetch("/api/agents")
      .then((response) => response.json())
      .then((payload) => setAgencyAgents(payload.agents ?? []))
      .catch(() => {
        // Non-blocking — agent enrichment falls back to scraped listing data.
      });
  }, []);

  useEffect(() => {
    setBrandAgency(agency);
  }, [agency]);

  useEffect(() => {
    if (step !== "preview") {
      return;
    }

    let cancelled = false;

    fetch("/api/agencies")
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled && payload.agency) {
          setBrandAgency(payload.agency);
        }
      })
      .catch(() => {
        // Keep the last known brand settings if refresh fails.
      });

    return () => {
      cancelled = true;
    };
  }, [step]);

  const finalReport = useMemo(() => {
    const cached = report.final_report_json as FinalReportJson | null;
    if (!cached) {
      return null;
    }

    return enrichFinalReportMetrics(
      listing,
      mergeAgencyBrandIntoFinalReport(brandAgency, cached),
      { agencyAgents },
    );
  }, [brandAgency, listing, report, agencyAgents]);

  async function publishReport() {
    setLoading(true);
    setPublishStage("publishing");

    const publishResponse = await fetch(`/api/reports/${report.id}/publish`, {
      method: "POST",
    });
    const publishPayload = await publishResponse.json();

    if (!publishResponse.ok) {
      toast.error(publishPayload.error ?? "Publish failed");
      setLoading(false);
      setPublishStage("idle");
      return;
    }

    setPublishStage("generating-pdf");
    const pdfResponse = await fetch(`/api/reports/${report.id}/generate-pdf`, {
      method: "POST",
    });
    const pdfPayload = await pdfResponse.json();

    if (!pdfResponse.ok) {
      toast.error(pdfPayload.error ?? "PDF generation failed");
      setLoading(false);
      setPublishStage("idle");
      return;
    }

    updateReport(pdfPayload.report);
    toast.success("Report published");
    setLoading(false);
    setPublishStage("idle");
  }

  return (
    <div className="space-y-6">
      <Tabs value={step} onValueChange={setStep}>
        <TabsList className="grid w-full grid-cols-3">
          {steps.map((item) => (
            <TabsTrigger key={item.id} value={item.id}>
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="estimate">
          <StrEstimateStep
            listing={listing}
            report={report}
            onComplete={({ listing: nextListing, report: nextReport }) => {
              updateListing(nextListing);
              updateReport(nextReport);
              setStep("copy");
            }}
          />
        </TabsContent>

        <TabsContent value="copy">
          <GeneratedCopyEditor
            agency={agency}
            agencyAgents={agencyAgents}
            listing={listing}
            report={report}
            onComplete={(nextReport) => {
              updateReport(nextReport);
            }}
            onContinueToPreview={() => setStep("preview")}
          />
        </TabsContent>

        <TabsContent value="preview" className="space-y-6">
          <AsyncLoadingOverlay
            active={loading}
            title={
              publishStage === "generating-pdf"
                ? "Generating PDF"
                : "Publishing report"
            }
            description={
              publishStage === "generating-pdf"
                ? "Rendering the final buyer pack. This can take 15–30 seconds."
                : "Saving the published report."
            }
          >
            {finalReport ? (
              <FittedReportPreview
                report={finalReport}
                maxHeight="min(80vh, 900px)"
                fitToWidth
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Generate copy first to preview the report.
              </p>
            )}
          </AsyncLoadingOverlay>
          <div className="flex flex-wrap gap-3 no-print">
            <Button variant="outline" disabled={loading}>
              Save draft
            </Button>
            <DownloadPdfButton
              url={report.pdf_url}
              reportId={report.id}
              cacheVersion={report.updated_at}
              canGenerate={Boolean(finalReport) && !loading}
              preview={report.status !== "published"}
              size="default"
              generateLabel="Generate PDF preview"
              regenerateLabel="Regenerate PDF preview"
              onGenerated={({ report: nextReport, pdf_url }) => {
                if (nextReport) {
                  updateReport(nextReport);
                  return;
                }

                if (pdf_url) {
                  updateReport({ ...report, pdf_url });
                }
              }}
            />
            <Button onClick={publishReport} disabled={loading || !finalReport}>
              {loading ? (
                <>
                  <Loader2 className="animate-spin" />
                  {publishStage === "generating-pdf"
                    ? "Generating PDF..."
                    : "Publishing..."}
                </>
              ) : (
                "Publish report"
              )}
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
  return "estimate";
}

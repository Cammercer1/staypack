"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { prepareReportPdf } from "@/lib/reports/reportRequests";
import { cacheBustedPdfUrl } from "@/lib/reports/cacheBustedPdfUrl";
import type { Report } from "@/lib/types";

type Props = {
  url?: string | null;
  reportId: string;
  canGenerate?: boolean;
  cacheVersion?: string | null;
  preview?: boolean;
  size?: VariantProps<typeof buttonVariants>["size"];
  generateLabel?: string;
  regenerateLabel?: string;
  downloadLabel?: string;
  onGenerated?: (payload: { pdf_url: string; report?: Report }) => void;
};

export function DownloadPdfButton({
  url,
  reportId,
  canGenerate = false,
  cacheVersion = null,
  preview = false,
  size = "sm",
  generateLabel = "Generate PDF",
  regenerateLabel = "Regenerate PDF",
  downloadLabel = "Download PDF",
  onGenerated,
}: Props) {
  const [generatedPdf, setGeneratedPdf] = useState<{
    reportId: string;
    url: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const pdfUrl = generatedPdf?.reportId === reportId ? generatedPdf.url : url;

  const downloadUrl = useMemo(() => {
    if (!pdfUrl) {
      return null;
    }

    if (pdfUrl.includes("?v=")) {
      return pdfUrl;
    }

    if (cacheVersion) {
      return cacheBustedPdfUrl(pdfUrl, cacheVersion);
    }

    return pdfUrl;
  }, [pdfUrl, cacheVersion]);

  async function generatePdf() {
    setLoading(true);

    try {
      const report = await prepareReportPdf({
        id: reportId,
        pdf_url: pdfUrl ?? null,
        status: preview ? "generated" : "published",
      });
      if (!report.pdf_url)
        throw new Error("PDF generation did not finish. Please try again.");
      setGeneratedPdf({ reportId, url: report.pdf_url });
      onGenerated?.({ pdf_url: report.pdf_url, report });
      toast.success("PDF ready");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "PDF generation failed",
      );
    } finally {
      setLoading(false);
    }
  }

  if (downloadUrl) {
    return (
      <div className="flex flex-wrap gap-2">
        <a
          href={`/api/reports/${reportId}/download`}
          className={buttonVariants({ variant: "outline", size })}
        >
          {downloadLabel}
        </a>
        {canGenerate ? (
          <Button
            variant="outline"
            size={size}
            disabled={loading}
            onClick={generatePdf}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                Regenerating...
              </>
            ) : (
              regenerateLabel
            )}
          </Button>
        ) : null}
      </div>
    );
  }

  if (canGenerate) {
    return (
      <Button
        variant="outline"
        size={size}
        disabled={loading}
        onClick={generatePdf}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" />
            Generating...
          </>
        ) : (
          generateLabel
        )}
      </Button>
    );
  }

  return (
    <Button variant="outline" size={size} disabled>
      {downloadLabel}
    </Button>
  );
}

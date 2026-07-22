"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
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

    const response = await fetch(`/api/reports/${reportId}/generate-pdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preview }),
    });
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload.error ?? "PDF generation failed");
      setLoading(false);
      return;
    }

    setGeneratedPdf({ reportId, url: payload.pdf_url });
    onGenerated?.({ pdf_url: payload.pdf_url, report: payload.report });
    toast.success("PDF ready");
    setLoading(false);
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

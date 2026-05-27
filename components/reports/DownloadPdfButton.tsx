"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cacheBustedPdfUrl } from "@/lib/reports/cacheBustedPdfUrl";

type Props = {
  url?: string | null;
  reportId: string;
  canGenerate?: boolean;
  cacheVersion?: string | null;
};

export function DownloadPdfButton({
  url,
  reportId,
  canGenerate = false,
  cacheVersion = null,
}: Props) {
  const [pdfUrl, setPdfUrl] = useState(url);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    setPdfUrl(url);
  }, [url]);

  async function generatePdf() {
    setLoading(true);

    const response = await fetch(`/api/reports/${reportId}/generate-pdf`, {
      method: "POST",
    });
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload.error ?? "PDF generation failed");
      setLoading(false);
      return;
    }

    setPdfUrl(payload.pdf_url);
    if (payload.pdf_url) {
      window.open(payload.pdf_url, "_blank", "noopener,noreferrer");
    }
    toast.success("PDF ready");
    setLoading(false);
  }

  if (downloadUrl) {
    return (
      <div className="flex flex-wrap gap-2">
        <Link href={downloadUrl} target="_blank">
          <Button variant="outline" size="sm">
            Download PDF
          </Button>
        </Link>
        {canGenerate ? (
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={generatePdf}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                Regenerating...
              </>
            ) : (
              "Regenerate PDF"
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
        size="sm"
        disabled={loading}
        onClick={generatePdf}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" />
            Generating...
          </>
        ) : (
          "Generate PDF"
        )}
      </Button>
    );
  }

  return (
    <Button variant="outline" size="sm" disabled>
      Download PDF
    </Button>
  );
}

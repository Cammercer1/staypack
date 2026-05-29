"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { cacheBustedPdfUrl } from "@/lib/reports/cacheBustedPdfUrl";
import type { buttonVariants } from "@/components/ui/button";
import type { CollateralItem } from "@/lib/types";

type Props = {
  collateralId: string;
  url?: string | null;
  canGenerate?: boolean;
  cacheVersion?: string | null;
  size?: VariantProps<typeof buttonVariants>["size"];
  downloadLabel?: string;
  onUpdated?: (collateral: CollateralItem) => void;
};

export function CollateralPdfButton({
  collateralId,
  url,
  canGenerate = false,
  cacheVersion = null,
  size = "sm",
  downloadLabel = "Download PDF",
  onUpdated,
}: Props) {
  const [pdfUrl, setPdfUrl] = useState(url);
  const [loading, setLoading] = useState(false);

  const downloadUrl = useMemo(() => {
    if (!pdfUrl) return null;
    if (pdfUrl.includes("?v=")) return pdfUrl;
    if (cacheVersion) return cacheBustedPdfUrl(pdfUrl, cacheVersion);
    return pdfUrl;
  }, [pdfUrl, cacheVersion]);

  useEffect(() => {
    setPdfUrl(url);
  }, [url]);

  async function generatePdf() {
    setLoading(true);

    const response = await fetch(`/api/collateral/${collateralId}/generate-pdf`, {
      method: "POST",
    });
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload.error ?? "PDF generation failed");
      setLoading(false);
      return;
    }

    setPdfUrl(payload.pdf_url);
    if (payload.collateral) {
      onUpdated?.(payload.collateral as CollateralItem);
    }
    toast.success("PDF ready");
    setLoading(false);
  }

  if (downloadUrl) {
    return (
      <div className="flex flex-wrap gap-2">
        <Link href={downloadUrl} target="_blank">
          <Button variant="outline" size={size}>
            {downloadLabel}
          </Button>
        </Link>
        {canGenerate ? (
          <Button variant="outline" size={size} disabled={loading} onClick={generatePdf}>
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
      <Button variant="outline" size={size} disabled={loading} onClick={generatePdf}>
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

  return null;
}

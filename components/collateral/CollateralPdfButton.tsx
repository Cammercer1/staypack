"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import type { VariantProps } from "class-variance-authority";
import { cacheBustedPdfUrl } from "@/lib/reports/cacheBustedPdfUrl";
import type { CollateralItem } from "@/lib/types";

type Props = {
  collateralId: string;
  url?: string | null;
  canGenerate?: boolean;
  generatedAt?: string | null;
  updatedAt?: string | null;
  cacheVersion?: string | null;
  size?: VariantProps<typeof buttonVariants>["size"];
  downloadLabel?: string;
  onUpdated?: (collateral: CollateralItem) => void;
};

export function CollateralPdfButton({
  collateralId,
  url,
  canGenerate = false,
  generatedAt = null,
  updatedAt = null,
  cacheVersion = null,
  size = "sm",
  downloadLabel = "Download asset",
  onUpdated,
}: Props) {
  const [generatedPdf, setGeneratedPdf] = useState<{
    collateralId: string;
    url: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const pdfUrl =
    generatedPdf?.collateralId === collateralId ? generatedPdf.url : url;

  const downloadUrl = useMemo(() => {
    if (!pdfUrl) return null;
    if (pdfUrl.includes("?v=")) return pdfUrl;
    if (cacheVersion) return cacheBustedPdfUrl(pdfUrl, cacheVersion);
    return pdfUrl;
  }, [pdfUrl, cacheVersion]);

  const hasPdf = Boolean(downloadUrl);
  const isStale =
    Boolean(hasPdf && generatedAt && updatedAt) &&
    new Date(updatedAt as string).getTime() > new Date(generatedAt as string).getTime();
  const needsGeneration = !hasPdf || isStale;

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

    setGeneratedPdf({ collateralId, url: payload.pdf_url });
    if (payload.collateral) {
      onUpdated?.(payload.collateral as CollateralItem);
    }
    toast.success("PDF ready");
    setLoading(false);
  }

  if (canGenerate && needsGeneration) {
    return (
      <Button variant="outline" size={size} disabled={loading} onClick={generatePdf}>
        {loading ? (
          <>
            <Loader2 className="animate-spin" />
            {hasPdf ? "Regenerating..." : "Generating..."}
          </>
        ) : (
          hasPdf ? "Regenerate PDF" : "Generate PDF"
        )}
      </Button>
    );
  }

  if (downloadUrl) {
    return (
      <a
        href={`/api/collateral/${collateralId}/download`}
        className={buttonVariants({ variant: "outline", size })}
      >
        {downloadLabel}
      </a>
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

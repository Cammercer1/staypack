"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  STR_REPORT_LABEL,
  reportEditorPath,
} from "@/lib/listings/collateralTypes";
import type { CollateralPhotoRequirement } from "@/lib/listings/collateralPhotoRequirements";

type Props = {
  listingId: string;
  photoRequirement: CollateralPhotoRequirement;
};

export function CreateStrReportButton({ listingId, photoRequirement }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function createReport() {
    if (!photoRequirement.met) return;

    setLoading(true);

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? `Unable to create ${STR_REPORT_LABEL}`);
      }

      router.push(reportEditorPath(listingId, payload.report.id));
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : `Unable to create ${STR_REPORT_LABEL}`,
      );
      setLoading(false);
    }
  }

  if (!photoRequirement.met) {
    return null;
  }

  return (
    <Button onClick={createReport} disabled={loading} size="sm">
      {loading ? (
        <>
          <Loader2 className="animate-spin" />
          Creating...
        </>
      ) : (
        <>Create {STR_REPORT_LABEL}</>
      )}
    </Button>
  );
}

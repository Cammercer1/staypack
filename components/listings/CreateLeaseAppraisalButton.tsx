"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  LEASE_APPRAISAL_LABEL,
  leaseAppraisalEditorPath,
} from "@/lib/listings/collateralTypes";
import type { CollateralPhotoRequirement } from "@/lib/listings/collateralPhotoRequirements";

type Props = {
  listingId: string;
  photoRequirement: CollateralPhotoRequirement;
  label?: string;
};

export function CreateLeaseAppraisalButton({
  listingId,
  photoRequirement,
  label = `Create ${LEASE_APPRAISAL_LABEL}`,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function createDraft() {
    if (!photoRequirement.met) return;

    setLoading(true);

    try {
      const response = await fetch(`/api/listings/${listingId}/lease-appraisal`, {
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? `Unable to create ${LEASE_APPRAISAL_LABEL}`);
      }

      router.push(leaseAppraisalEditorPath(listingId));
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : `Unable to create ${LEASE_APPRAISAL_LABEL}`,
      );
      setLoading(false);
    }
  }

  if (!photoRequirement.met) {
    return null;
  }

  return (
    <Button onClick={createDraft} disabled={loading} size="sm">
      {loading ? (
        <>
          <Loader2 className="animate-spin" />
          Fetching comps…
        </>
      ) : (
        label
      )}
    </Button>
  );
}

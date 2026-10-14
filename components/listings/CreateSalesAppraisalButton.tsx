"use client";
import Link from "next/link";
import type { CollateralPhotoRequirement } from "@/lib/listings/collateralPhotoRequirements";
export function CreateSalesAppraisalButton({ listingId, photoRequirement, label = "Create sales appraisal" }: { listingId: string; photoRequirement: CollateralPhotoRequirement; label?: string }) {
  if (!photoRequirement.met) return null;
  return <Link className="du-btn du-btn-sm min-h-10" href={`/appraisals/new?kind=sales&listing_id=${listingId}`}>{label}</Link>;
}

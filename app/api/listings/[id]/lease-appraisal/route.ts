import { NextResponse } from "next/server";
import { requireListingAccess } from "@/lib/auth/requireUser";
import {
  createLeaseAppraisalDraft,
  enrichListingForLeaseAppraisal,
  hasLeaseAppraisalComps,
} from "@/lib/lease-appraisal/generateLeaseAppraisalForListing";
import { collateralPhotoRequirementError } from "@/lib/listings/collateralPhotoRequirements";
import { stripInternalRentalAppraisalWarnings } from "@/lib/rental/userFacingRentalWarnings";

export const maxDuration = 300;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, agency, user, listing } = await requireListingAccess(id);

    const photoError = collateralPhotoRequirementError(listing);
    if (photoError) {
      return NextResponse.json({ error: photoError }, { status: 400 });
    }

    const result = await createLeaseAppraisalDraft({
      supabase,
      agency,
      listing,
      userId: user.id,
    });

    let nextListing = result.listing;
    let warnings: string[] = [];
    let compCount = 0;

    if (!hasLeaseAppraisalComps(nextListing.scraped_listing_json)) {
      const enriched = await enrichListingForLeaseAppraisal({
        supabase,
        listing: nextListing,
      });
      nextListing = enriched.listing;
      warnings = enriched.warnings;
      compCount = enriched.parsed.rentalAppraisal?.compCount ?? 0;
    } else {
      compCount =
        nextListing.scraped_listing_json?.rentalAppraisal?.compCount ?? 0;
      warnings = stripInternalRentalAppraisalWarnings(
        nextListing.scraped_listing_json?.warnings ?? [],
      );
    }

    return NextResponse.json({
      report: result.report,
      listing: nextListing,
      warnings,
      compCount,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create lease appraisal",
      },
      { status: 400 },
    );
  }
}

import { NextResponse } from "next/server";
import { requireListingAccess } from "@/lib/auth/requireUser";
import { createSalesAppraisalDraft } from "@/lib/sales-appraisal/generateSalesAppraisalForListing";
import { collateralPhotoRequirementError } from "@/lib/listings/collateralPhotoRequirements";

export const maxDuration = 60;

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

    const result = await createSalesAppraisalDraft({
      supabase,
      agency,
      listing,
      userId: user.id,
    });

    return NextResponse.json({
      report: result.report,
      listing: result.listing,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create property appraisal",
      },
      { status: 400 },
    );
  }
}

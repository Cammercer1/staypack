import { NextResponse } from "next/server";
import { requireListingAccess } from "@/lib/auth/requireUser";
import { enrichListingForLeaseAppraisal } from "@/lib/lease-appraisal/generateLeaseAppraisalForListing";
import { stripInternalRentalAppraisalWarnings } from "@/lib/rental/userFacingRentalWarnings";

export const maxDuration = 120;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, listing } = await requireListingAccess(id);
    const result = await enrichListingForLeaseAppraisal({ supabase, listing });

    return NextResponse.json({
      listing: result.listing,
      warnings: stripInternalRentalAppraisalWarnings(result.warnings),
      compCount: result.parsed.rentalAppraisal?.compCount ?? 0,
      weeklyMin: result.parsed.rentalAppraisal?.weeklyMin ?? null,
      weeklyMax: result.parsed.rentalAppraisal?.weeklyMax ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to fetch rental comps",
      },
      { status: 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireListingAccess } from "@/lib/auth/requireUser";
import {
  applyLeaseAppraisalCompSelection,
  applyLeaseAppraisalRentOverrides,
  MAX_LEASE_APPRAISAL_FEATURED_COMPS,
} from "@/lib/lease-appraisal/leaseAppraisalData";
import { stripInternalRentalAppraisalWarnings } from "@/lib/rental/userFacingRentalWarnings";
import type { ParsedListing } from "@/lib/types";

const bodySchema = z.object({
  weekly_min: z.number().positive().optional().nullable(),
  weekly_max: z.number().positive().optional().nullable(),
  weekly_midpoint: z.number().positive().optional().nullable(),
  selected_comp_listing_ids: z
    .array(z.string().min(1))
    .max(MAX_LEASE_APPRAISAL_FEATURED_COMPS)
    .optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, listing } = await requireListingAccess(id);
    const body = bodySchema.parse(await request.json());

    const parsed = listing.scraped_listing_json as ParsedListing | null;
    if (!parsed) {
      return NextResponse.json(
        { error: "Import the listing URL first" },
        { status: 400 },
      );
    }

    let nextParsed = parsed;

    if (
      body.weekly_min != null ||
      body.weekly_max != null ||
      body.weekly_midpoint != null
    ) {
      nextParsed = applyLeaseAppraisalRentOverrides(nextParsed, {
        weeklyMin: body.weekly_min ?? undefined,
        weeklyMax: body.weekly_max ?? undefined,
        weeklyMidpoint: body.weekly_midpoint ?? undefined,
      });
    }

    if (body.selected_comp_listing_ids) {
      nextParsed = applyLeaseAppraisalCompSelection(
        nextParsed,
        body.selected_comp_listing_ids,
      );
    }

    nextParsed = {
      ...nextParsed,
      warnings: stripInternalRentalAppraisalWarnings(nextParsed.warnings ?? []),
    };

    const { data: updatedListing, error } = await supabase
      .from("listings")
      .update({ scraped_listing_json: nextParsed })
      .eq("id", listing.id)
      .select("*")
      .single();

    if (error || !updatedListing) {
      return NextResponse.json(
        { error: error?.message ?? "Unable to save appraisal data" },
        { status: 400 },
      );
    }

    return NextResponse.json({ listing: updatedListing });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to save appraisal data",
      },
      { status: 400 },
    );
  }
}

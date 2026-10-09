import { validPriceBand } from "@/lib/listings/pricing";
import { resolveAppraisalInput, hasStaleAppraisal } from "@/lib/appraisals/resolveAppraisalInput";
import { saveAppraisalResults } from "@/lib/appraisals/saveAppraisalResults";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireListingAccess } from "@/lib/auth/requireUser";
import {
  applyLeaseAppraisalCompSelection,
  MAX_LEASE_APPRAISAL_FEATURED_COMPS,
} from "@/lib/lease-appraisal/leaseAppraisalData";
import { stripInternalRentalAppraisalWarnings } from "@/lib/rental/userFacingRentalWarnings";

const bodySchema = z.object({
  reset_price: z.boolean().optional(),
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

    const parsed = resolveAppraisalInput(listing, { applyOverrides: false });
    if (hasStaleAppraisal(listing, "lease")) {
      return NextResponse.json(
        { error: "Property details changed. Fetch comparables again before saving appraisal data." },
        { status: 400 },
      );
    }

    let nextParsed = parsed;

    const priceOverrides = { ...listing.appraisal_overrides_json };
    if (body.reset_price) {
      delete priceOverrides.lease;
    } else if (body.weekly_min != null || body.weekly_max != null || body.weekly_midpoint != null) {
      const override = { weeklyMin: body.weekly_min ?? null, weeklyMax: body.weekly_max ?? null, weeklyMidpoint: body.weekly_midpoint ?? null };
      if (!validPriceBand(override.weeklyMin, override.weeklyMax, override.weeklyMidpoint)) {
        return NextResponse.json({ error: "Minimum must not exceed maximum, and midpoint must be within the range." }, { status: 400 });
      }
      priceOverrides.lease = override;
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

    const updatedListing = await saveAppraisalResults({ supabase, listing, kind: "lease", parsed: nextParsed, priceOverrides });

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

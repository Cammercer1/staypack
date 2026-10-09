import { validPriceBand } from "@/lib/listings/pricing";
import { resolveAppraisalInput, hasStaleAppraisal } from "@/lib/appraisals/resolveAppraisalInput";
import { saveAppraisalResults } from "@/lib/appraisals/saveAppraisalResults";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireListingAccess } from "@/lib/auth/requireUser";
import {
  applySalesAppraisalAgentReviewConfirmation,
  applySalesAppraisalCompSelection,
  MAX_SALES_APPRAISAL_FEATURED_COMPS,
} from "@/lib/sales-appraisal/salesAppraisalData";
import { stripInternalSalesAppraisalWarnings } from "@/lib/sales/userFacingSalesWarnings";

const bodySchema = z.object({
  reset_price: z.boolean().optional(),
  price_min: z.number().positive().optional().nullable(),
  price_max: z.number().positive().optional().nullable(),
  price_midpoint: z.number().positive().optional().nullable(),
  selected_comp_listing_ids: z
    .array(z.string().min(1))
    .max(MAX_SALES_APPRAISAL_FEATURED_COMPS)
    .optional(),
  agent_review_confirmed: z.boolean().optional(),
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
    if (hasStaleAppraisal(listing, "sales")) {
      return NextResponse.json(
        { error: "Property details changed. Fetch comparables again before saving appraisal data." },
        { status: 400 },
      );
    }

    let nextParsed = parsed;

    const priceOverrides = { ...listing.appraisal_overrides_json };
    if (body.reset_price) {
      delete priceOverrides.sales;
    } else if (body.price_min != null || body.price_max != null || body.price_midpoint != null) {
      const override = { priceMin: body.price_min ?? null, priceMax: body.price_max ?? null, priceMidpoint: body.price_midpoint ?? null };
      if (!validPriceBand(override.priceMin, override.priceMax, override.priceMidpoint)) {
        return NextResponse.json({ error: "Minimum must not exceed maximum, and midpoint must be within the range." }, { status: 400 });
      }
      priceOverrides.sales = override;
    }

    if (body.selected_comp_listing_ids) {
      nextParsed = applySalesAppraisalCompSelection(
        nextParsed,
        body.selected_comp_listing_ids,
      );
    }

    if (body.agent_review_confirmed != null) {
      nextParsed = applySalesAppraisalAgentReviewConfirmation(
        nextParsed,
        body.agent_review_confirmed,
      );
    }

    nextParsed = {
      ...nextParsed,
      warnings: stripInternalSalesAppraisalWarnings(nextParsed.warnings ?? []),
    };

    const updatedListing = await saveAppraisalResults({ supabase, listing, kind: "sales", parsed: nextParsed, priceOverrides });

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

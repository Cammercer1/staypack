import { resolveAppraisalInput, hasStaleAppraisal } from "@/lib/appraisals/resolveAppraisalInput";
import { saveAppraisalResults } from "@/lib/appraisals/saveAppraisalResults";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireListingAccess } from "@/lib/auth/requireUser";
import {
  applySalesAppraisalAgentReviewConfirmation,
  applySalesAppraisalCompSelection,
  applySalesAppraisalPriceOverrides,
  MAX_SALES_APPRAISAL_FEATURED_COMPS,
} from "@/lib/sales-appraisal/salesAppraisalData";
import { stripInternalSalesAppraisalWarnings } from "@/lib/sales/userFacingSalesWarnings";

const bodySchema = z.object({
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

    const parsed = resolveAppraisalInput(listing);
    if (hasStaleAppraisal(listing, "sales")) {
      return NextResponse.json(
        { error: "Property details changed. Fetch comparables again before saving appraisal data." },
        { status: 400 },
      );
    }

    let nextParsed = parsed;

    if (
      body.price_min != null ||
      body.price_max != null ||
      body.price_midpoint != null
    ) {
      nextParsed = applySalesAppraisalPriceOverrides(nextParsed, {
        priceMin: body.price_min ?? undefined,
        priceMax: body.price_max ?? undefined,
        priceMidpoint: body.price_midpoint ?? undefined,
      });
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

    const updatedListing = await saveAppraisalResults({ supabase, listing, kind: "sales", parsed: nextParsed });

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

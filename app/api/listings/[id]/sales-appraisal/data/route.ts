import { NextResponse } from "next/server";
import { z } from "zod";
import { requireListingAccess } from "@/lib/auth/requireUser";
import {
  applySalesAppraisalCompSelection,
  applySalesAppraisalPriceOverrides,
  MAX_SALES_APPRAISAL_FEATURED_COMPS,
} from "@/lib/sales-appraisal/salesAppraisalData";
import { stripInternalSalesAppraisalWarnings } from "@/lib/sales/userFacingSalesWarnings";
import type { ParsedListing } from "@/lib/types";

const bodySchema = z.object({
  price_min: z.number().positive().optional().nullable(),
  price_max: z.number().positive().optional().nullable(),
  price_midpoint: z.number().positive().optional().nullable(),
  selected_comp_listing_ids: z
    .array(z.string().min(1))
    .max(MAX_SALES_APPRAISAL_FEATURED_COMPS)
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

    nextParsed = {
      ...nextParsed,
      warnings: stripInternalSalesAppraisalWarnings(nextParsed.warnings ?? []),
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

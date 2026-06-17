import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireListingAccess } from "@/lib/auth/requireUser";
import { enrichListingForLeaseAppraisal } from "@/lib/lease-appraisal/generateLeaseAppraisalForListing";
import {
  isLeaseAppraisalEnrichmentActive,
  leaseAppraisalEnrichmentStatus,
  failedLeaseAppraisalEnrichmentStatus,
  processingLeaseAppraisalEnrichmentStatus,
  withLeaseAppraisalEnrichmentStatus,
} from "@/lib/lease-appraisal/enrichmentStatus";
import {
  LEASE_APPRAISAL_ENRICH_SIGNATURE_HEADER,
  LEASE_APPRAISAL_ENRICH_TS_HEADER,
  signLeaseAppraisalEnrichBody,
} from "@/lib/lease-appraisal/enrichmentJobAuth";
import { stripInternalRentalAppraisalWarnings } from "@/lib/rental/userFacingRentalWarnings";
import { isDevelopment } from "@/lib/env";

export const maxDuration = 60;

const BACKGROUND_ENRICH_PATH = "/background/lease-appraisal-enrich";

function shouldRunSynchronously() {
  return isDevelopment() || process.env.LEASE_APPRAISAL_ENRICH_SYNC === "1";
}

function backgroundUrl(request: Request) {
  const override = process.env.LEASE_APPRAISAL_ENRICH_BACKGROUND_URL?.trim();
  if (override) {
    return override;
  }

  return new URL(BACKGROUND_ENRICH_PATH, request.url).toString();
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, listing, agency } = await requireListingAccess(id);

    if (shouldRunSynchronously()) {
      const result = await enrichListingForLeaseAppraisal({ supabase, listing });

      return NextResponse.json({
        listing: result.listing,
        warnings: stripInternalRentalAppraisalWarnings(result.warnings),
        compCount: result.parsed.rentalAppraisal?.compCount ?? 0,
        weeklyMin: result.parsed.rentalAppraisal?.weeklyMin ?? null,
        weeklyMax: result.parsed.rentalAppraisal?.weeklyMax ?? null,
      });
    }

    const parsed = listing.scraped_listing_json;
    if (!parsed) {
      return NextResponse.json(
        { error: "Import the listing URL first" },
        { status: 400 },
      );
    }

    const currentStatus = leaseAppraisalEnrichmentStatus(parsed);
    if (isLeaseAppraisalEnrichmentActive(currentStatus)) {
      return NextResponse.json(
        {
          listing,
          status: "processing",
          requestId: currentStatus?.requestId,
        },
        { status: 202 },
      );
    }

    const requestId = randomUUID();
    const processing = withLeaseAppraisalEnrichmentStatus(
      parsed,
      processingLeaseAppraisalEnrichmentStatus(requestId),
    );

    const { data: processingListing, error: processingError } = await supabase
      .from("listings")
      .update({ scraped_listing_json: processing })
      .eq("id", listing.id)
      .select("*")
      .single();

    if (processingError || !processingListing) {
      return NextResponse.json(
        { error: processingError?.message ?? "Unable to start rental comps" },
        { status: 400 },
      );
    }

    const body = JSON.stringify({
      listingId: listing.id,
      agencyId: agency.id,
      requestId,
    });
    const { timestamp, signature } = signLeaseAppraisalEnrichBody(body);
    const invokeResponse = await fetch(backgroundUrl(request), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        [LEASE_APPRAISAL_ENRICH_TS_HEADER]: timestamp,
        [LEASE_APPRAISAL_ENRICH_SIGNATURE_HEADER]: signature,
      },
      body,
      cache: "no-store",
    });

    if (!invokeResponse.ok) {
      const failed = withLeaseAppraisalEnrichmentStatus(
        processing,
        failedLeaseAppraisalEnrichmentStatus(
          leaseAppraisalEnrichmentStatus(processing),
          requestId,
          `Unable to start background rental comps (${invokeResponse.status})`,
        ),
      );

      const { data: failedListing } = await supabase
        .from("listings")
        .update({ scraped_listing_json: failed })
        .eq("id", listing.id)
        .select("*")
        .single();

      return NextResponse.json(
        {
          error: "Unable to start rental comps",
          listing: failedListing ?? processingListing,
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        listing: processingListing,
        status: "processing",
        requestId,
      },
      { status: 202 },
    );
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

import { resolveDeliveryAgency } from "@/lib/delivery/brand/ensureShadowAgency";
import { generateHeadlessLeaseAppraisal } from "@/lib/delivery/lease/generateHeadlessLeaseAppraisal";
import {
  createDeliveryListingFromParsed,
  updateDeliveryListingScrapedJson,
} from "@/lib/delivery/listing/createDeliveryListing";
import { extractListingForDelivery } from "@/lib/scraping/extractListingForDelivery";
import type {
  DeliveryProcessedListing,
  DeliveryReportArtifact,
  DeliveryReportsJson,
  DeliveryTenant,
} from "@/lib/delivery/types";
import {
  evaluateLedgerGate,
  fingerprintForParsed,
} from "@/lib/delivery/property-ledger/gate";
import {
  sourceListingIdFromUrl,
  sourceSiteFromUrl,
  newDeliveryId,
} from "@/lib/delivery/property-ledger/identity";
import {
  getTenantProperty,
  markPropertyDelivered,
  markPropertyFailed,
  markPropertyProcessing,
  touchPropertyLastSeen,
  upsertTenantPropertySeen,
} from "@/lib/delivery/property-ledger/repository";
import { rentAppraisalTierSetting } from "@/lib/delivery/rentAppraisalConfig";
import { generateHeadlessStrReport } from "@/lib/delivery/str/generateHeadlessStr";
import { enrichListingRentalAppraisal } from "@/lib/rental/enrichListingRentalAppraisal";
import { emitUsageEvent } from "@/lib/delivery/usage/events";

export type ProcessListingResult =
  | { outcome: "processed"; item: DeliveryProcessedListing }
  | { outcome: "skipped"; reason: string }
  | { outcome: "failed"; error: string };

function toReportArtifact(result: {
  reportId: string;
  publicUrl: string;
  pdfUrl: string;
  pdfFilename: string;
}): DeliveryReportArtifact {
  return {
    reportId: result.reportId,
    publicUrl: result.publicUrl,
    pdfUrl: result.pdfUrl,
    pdfFilename: result.pdfFilename,
  };
}

function wantsStr(tenant: DeliveryTenant) {
  return tenant.deliverables.includes("str");
}

function wantsLease(tenant: DeliveryTenant) {
  return tenant.deliverables.includes("lease_appraisal");
}

export async function processDeliveryListing({
  tenant,
  listingUrl,
  scrapeRunId,
}: {
  tenant: DeliveryTenant;
  listingUrl: string;
  scrapeRunId: string;
}): Promise<ProcessListingResult> {
  const billingMode = tenant.billing_mode;
  const sourceSite = sourceSiteFromUrl(listingUrl);

  if (!wantsStr(tenant) && !wantsLease(tenant)) {
    return {
      outcome: "failed",
      error: "Tenant has no deliverables configured",
    };
  }

  let parsed;
  try {
    const extracted = await extractListingForDelivery(listingUrl);
    if (!extracted.ok) {
      return {
        outcome: "failed",
        error: extracted.reason,
      };
    }
    parsed = extracted.listing;
  } catch (error) {
    return {
      outcome: "failed",
      error: error instanceof Error ? error.message : "Scrape failed",
    };
  }

  const sourceListingId = sourceListingIdFromUrl(
    listingUrl,
    parsed.address ?? null,
  );
  const fingerprint = fingerprintForParsed(parsed);

  const existing = await getTenantProperty(
    tenant.id,
    sourceSite,
    sourceListingId,
  );

  const gate = evaluateLedgerGate(tenant, existing, fingerprint);

  if (gate.action === "skip") {
    if (existing) {
      await touchPropertyLastSeen(existing.id);
    }
    await emitUsageEvent({
      tenantId: tenant.id,
      eventType: "listing.skipped",
      billingMode,
      sourceListingId,
      scrapeRunId,
      metadata: { reason: gate.reason, listingUrl },
    });
    return { outcome: "skipped", reason: gate.reason };
  }

  let propertyId = existing?.id;

  if (!propertyId) {
    const created = await upsertTenantPropertySeen({
      tenantId: tenant.id,
      sourceSite,
      sourceListingId,
      listingUrl,
      fingerprint,
      status: "discovered",
    });
    propertyId = created.id;

    await emitUsageEvent({
      tenantId: tenant.id,
      eventType: "listing.discovered",
      billingMode,
      sourceListingId,
      scrapeRunId,
      metadata: { listingUrl },
    });
  } else {
    await markPropertyProcessing(propertyId, fingerprint);
  }

  const deliveryId = newDeliveryId(tenant.id, sourceListingId);

  try {
    const agency = await resolveDeliveryAgency({
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      tenantName: tenant.name,
      agencyId: tenant.agency_id,
      brand: tenant.brand,
    });

    const listing = await createDeliveryListingFromParsed({
      agency,
      listingUrl,
      parsed,
    });

    const reports: DeliveryReportsJson = {};
    let address =
      [listing.property_address, listing.suburb, listing.state]
        .filter(Boolean)
        .join(", ") || parsed.address!;

    if (wantsStr(tenant)) {
      const str = await generateHeadlessStrReport({
        tenant,
        listingUrl,
        parsed,
        listing,
        agency,
      });

      reports.str = toReportArtifact(str);
      address = str.address;

      await emitUsageEvent({
        tenantId: tenant.id,
        eventType: "str_report.generated",
        billingMode,
        sourceListingId,
        deliveryId,
        scrapeRunId,
        metadata: { reportId: str.reportId },
      });
    }

    if (wantsLease(tenant)) {
      const enriched = await enrichListingRentalAppraisal(parsed, {
        subjectListingUrl: listingUrl,
        rentAppraisalConfig: {
          tier: rentAppraisalTierSetting(tenant) ?? "auto",
        },
      });


      if (enriched.rentalAppraisal?.weeklyMin == null || enriched.rentalAppraisal?.weeklyMax == null) {
        throw new Error(
          enriched.warnings?.find((w) => w.startsWith("Rental appraisal")) ??
            "Lease appraisal could not compute a weekly rent range",
        );
      }

      await updateDeliveryListingScrapedJson(listing.id, enriched);

      const lease = await generateHeadlessLeaseAppraisal({
        tenant,
        listingUrl,
        parsed: enriched,
        listing,
        agency,
      });

      reports.lease = toReportArtifact(lease);
      address = lease.address;

      await emitUsageEvent({
        tenantId: tenant.id,
        eventType: "lease_report.generated",
        billingMode,
        sourceListingId,
        deliveryId,
        scrapeRunId,
        metadata: { reportId: lease.reportId },
      });
    }

    const primaryReportId =
      reports.str?.reportId ?? reports.lease?.reportId ?? null;

    if (!primaryReportId) {
      throw new Error("No reports were generated");
    }

    await markPropertyDelivered({
      id: propertyId,
      deliveryId,
      reportId: primaryReportId,
      listingId: listing.id,
      deliveryReports: reports,
    });

    const item: DeliveryProcessedListing = {
      deliveryId,
      address,
      listingUrl,
      listingId: listing.id,
      reports,
    };

    if (billingMode === "shadow") {
      console.info("[delivery] shadow mode — reports generated, digest not sent", {
        tenant: tenant.slug,
        address,
        deliveryId,
        reports,
      });
    }

    return { outcome: "processed", item };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed";
    await markPropertyFailed(propertyId, message);
    await emitUsageEvent({
      tenantId: tenant.id,
      eventType: "delivery.failed",
      billingMode,
      sourceListingId,
      deliveryId,
      scrapeRunId,
      metadata: { error: message },
    });
    return { outcome: "failed", error: message };
  }
}

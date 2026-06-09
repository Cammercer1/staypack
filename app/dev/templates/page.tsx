import Link from "next/link";
import { notFound } from "next/navigation";
import { TemplatePlayground } from "@/components/dev/TemplatePlayground";
import { Button } from "@/components/ui/button";
import { mergeAgencyBrandIntoCollateralDocument } from "@/lib/collateral/mergeAgencyBrand";
import { createPlaygroundSalesBrochureDocument } from "@/lib/collateral/sales-brochure/playgroundFixture";
import { getLeaseAppraisalPlaygroundReport } from "@/lib/lease-appraisal/leaseAppraisalPlayground";
import { loadPlaygroundListingContext } from "@/lib/reports/loadPlaygroundListingContext";
import { loadPlaygroundReportOptional } from "@/lib/reports/loadPlaygroundReport";
import { mergeAgencyBrandIntoFinalReport } from "@/lib/reports/mergeAgencyBrand";
import {
  enrichPlaygroundFinalReportAgents,
  enrichPlaygroundSalesBrochureAgents,
} from "@/lib/reports/playgroundListingPreview";
import { getStrPlaygroundReport } from "@/lib/reports/strPlayground";
import type { BrochureDocumentJson } from "@/lib/collateral/templates/types";
import type { Agency, Listing } from "@/lib/types";

function listingNotFound(id: string, label: "Listing" | "Report") {
  return (
    <div className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold">{label} not found</h1>
        <p className="text-sm text-muted-foreground">
          Check the ID, sign in to the account that owns the listing, or use the
          fixture playground.
        </p>
        <p className="break-all font-mono text-xs text-muted-foreground">{id}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/dev/templates">
            <Button>Use fixture preview</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

function brandedSalesFixture(agency: Agency): BrochureDocumentJson {
  return mergeAgencyBrandIntoCollateralDocument(
    agency,
    createPlaygroundSalesBrochureDocument(),
  ) as BrochureDocumentJson;
}

function listingPlaygroundFromContext(
  ctx: NonNullable<Awaited<ReturnType<typeof loadPlaygroundListingContext>>>,
  leaseFixture: ReturnType<typeof getLeaseAppraisalPlaygroundReport>,
) {
  const agents = {
    agentProfile: ctx.agentProfile,
    agencyAgents: ctx.agencyAgents,
  };
  const listingPriceSource: Pick<Listing, "display_price" | "scraped_listing_json"> = {
    display_price: null,
    scraped_listing_json: ctx.listingPreview.scraped_listing_json,
  };

  const strReport =
    ctx.strReport ??
    enrichPlaygroundFinalReportAgents(
      listingPriceSource,
      mergeAgencyBrandIntoFinalReport(ctx.agency, getStrPlaygroundReport()),
      agents,
    );
  const leaseReport =
    ctx.leaseReport ??
    enrichPlaygroundFinalReportAgents(
      listingPriceSource,
      mergeAgencyBrandIntoFinalReport(ctx.agency, leaseFixture),
      agents,
    );

  return (
    <TemplatePlayground
      mode="listing"
      listingId={ctx.listingId}
      reportId={ctx.strReportId ?? "listing"}
      agencyName={ctx.agency.name}
      agencyPrimaryColour={ctx.agency.primary_colour}
      propertyAddress={ctx.propertyAddress}
      strReport={strReport}
      leaseReport={leaseReport}
      salesBrochure={ctx.salesBrochure}
      listingPreview={ctx.listingPreview}
      agentProfile={ctx.agentProfile}
      agencyAgents={ctx.agencyAgents}
      liveFlags={{
        str: ctx.hasLiveStr,
        lease: ctx.hasLiveLease,
        sale: ctx.hasLiveSales,
      }}
      strReportId={ctx.strReportId}
      leaseReportId={ctx.leaseReportId}
    />
  );
}

export default async function DevTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ reportId?: string; listingId?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { reportId, listingId } = await searchParams;
  const leaseFixture = getLeaseAppraisalPlaygroundReport();
  const salesBrochureFixture = createPlaygroundSalesBrochureDocument();

  if (listingId) {
    const ctx = await loadPlaygroundListingContext(listingId);
    if (!ctx) {
      return listingNotFound(listingId, "Listing");
    }
    return listingPlaygroundFromContext(ctx, leaseFixture);
  }

  if (reportId) {
    const loaded = await loadPlaygroundReportOptional(reportId);

    if (!loaded) {
      const asListing = await loadPlaygroundListingContext(reportId);
      if (asListing) {
        return listingPlaygroundFromContext(asListing, leaseFixture);
      }
      return listingNotFound(reportId, "Report");
    }

    const ctx = await loadPlaygroundListingContext(loaded.listing.id);
    const agents = {
      agentProfile: loaded.agentProfile,
      agencyAgents: loaded.agencyAgents,
    };
    const strReport = loaded.finalReport;
    const leaseReport =
      ctx?.leaseReport ??
      enrichPlaygroundFinalReportAgents(
        loaded.listing,
        mergeAgencyBrandIntoFinalReport(loaded.agency, leaseFixture),
        agents,
      );
    const salesBrochure = ctx?.salesBrochure
      ? ctx.salesBrochure
      : enrichPlaygroundSalesBrochureAgents(
          loaded.listing,
          brandedSalesFixture(loaded.agency),
          agents,
        );

    return (
      <TemplatePlayground
        mode="report"
        listingId={loaded.listing.id}
        reportId={reportId}
        agencyName={loaded.agency.name}
        agencyPrimaryColour={loaded.agency.primary_colour}
        propertyAddress={loaded.listing.property_address}
        strReport={strReport}
        leaseReport={leaseReport}
        salesBrochure={salesBrochure}
        listingPreview={loaded.listingPreview}
        agentProfile={loaded.agentProfile}
        agencyAgents={loaded.agencyAgents}
        liveFlags={{
          str: true,
          lease: Boolean(ctx?.hasLiveLease),
          sale: Boolean(ctx?.hasLiveSales),
        }}
        strReportId={reportId}
        leaseReportId={ctx?.leaseReportId ?? null}
      />
    );
  }

  const strFixture = getStrPlaygroundReport();

  return (
    <TemplatePlayground
      mode="fixture"
      strReport={strFixture}
      leaseReport={leaseFixture}
      salesBrochure={salesBrochureFixture}
      reportId="fixture"
      propertyAddress={strFixture.property.address}
    />
  );
}

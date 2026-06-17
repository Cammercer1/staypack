import Link from "next/link";
import { notFound } from "next/navigation";
import { BellePropertiesPlayground } from "@/components/dev/BellePropertiesPlayground";
import { Button } from "@/components/ui/button";
import { requireAgency } from "@/lib/auth/requireUser";
import { loadDevListingAccess } from "@/lib/dev/loadDevListingAccess";
import { resolvePlaygroundFinalReport } from "@/lib/reports/resolvePlaygroundFinalReport";
import { resolvePlaygroundReportForListing } from "@/lib/reports/resolvePlaygroundReportForListing";

async function resolveBellePlaygroundBundle(listingId: string) {
  try {
    const { supabase } = await requireAgency();
    const bundle = await resolvePlaygroundReportForListing(supabase, listingId);
    if (bundle) {
      return { supabase, bundle };
    }
  } catch {
    // fall through to dev admin access
  }

  const devAccess = await loadDevListingAccess(listingId);
  if (!devAccess) {
    return null;
  }

  const bundle = await resolvePlaygroundReportForListing(
    devAccess.supabase,
    listingId,
  );
  if (!bundle) {
    return null;
  }

  return { supabase: devAccess.supabase, bundle };
}

export default async function DevBellePropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ listingId?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { listingId } = await searchParams;
  if (!listingId) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold">Belle STR preview</h1>
          <p className="text-sm text-muted-foreground">
            Pass <code className="text-xs">?listingId=...</code> to preview with live listing data.
          </p>
        </div>
      </div>
    );
  }

  const resolved = await resolveBellePlaygroundBundle(listingId);

  if (!resolved) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8">
        <div className="max-w-md space-y-4 text-center">
          <h1 className="text-xl font-semibold">Listing missing preview data</h1>
          <p className="text-sm text-muted-foreground">
            This listing needs an STR report with an estimate and generated collateral.
          </p>
          <p className="break-all font-mono text-xs text-muted-foreground">{listingId}</p>
          <Link href={`/listings/${listingId}`}>
            <Button variant="outline">Open listing</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { supabase, bundle } = resolved;

  const finalReport = await resolvePlaygroundFinalReport(
    supabase,
    bundle.agency,
    bundle.listing,
    bundle.report,
  );

  if (!finalReport) {
    notFound();
  }

  return (
    <BellePropertiesPlayground
      listingId={listingId}
      reportId={bundle.report.id}
      propertyAddress={bundle.listing.property_address}
      baseReport={finalReport}
    />
  );
}

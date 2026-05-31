import { notFound, redirect } from "next/navigation";
import {
  agencySlugNeedsRedirect,
  resolveAgencyBySlug,
} from "@/lib/agencies/resolveAgencyBySlug";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/env";
import { CollateralPreview } from "@/components/collateral/CollateralPreview";
import { resolveSalesBrochurePrintDocument } from "@/lib/collateral/enrichSalesBrochureDocument";
import type { Agency, CollateralDocumentJson, CollateralType } from "@/lib/types";

export default async function PublicCollateralPrintPage({
  params,
}: {
  params: Promise<{ agencySlug: string; collateralSlug: string }>;
}) {
  const { agencySlug, collateralSlug } = await params;

  if (!hasServiceRoleKey()) {
    notFound();
  }

  const admin = createAdminClient();
  const agency = await resolveAgencyBySlug(admin, agencySlug);

  if (!agency) {
    notFound();
  }

  if (agencySlugNeedsRedirect(agency, agencySlug)) {
    redirect(`/${agency.slug}/c/${collateralSlug}/print`);
  }

  const { data: collateral } = await admin
    .from("collateral_items")
    .select("document_json, type, status, listing_id, agency_id")
    .eq("agency_id", agency.id)
    .eq("public_slug", collateralSlug)
    .in("status", ["generated", "published"])
    .maybeSingle();

  if (!collateral?.document_json) {
    notFound();
  }

  const document = await resolveSalesBrochurePrintDocument({
    admin,
    agency: agency as Agency,
    collateral: {
      document_json: collateral.document_json as CollateralDocumentJson,
      listing_id: collateral.listing_id,
      agency_id: collateral.agency_id,
    },
  });

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            html, body {
              margin: 0;
              padding: 0;
              background: #000;
            }
            .collateral-print-root {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
          `,
        }}
      />
      <div className="collateral-print-root print-mode">
        <CollateralPreview
          document={document}
          collateralType={collateral.type as CollateralType}
          printMode
        />
      </div>
    </>
  );
}

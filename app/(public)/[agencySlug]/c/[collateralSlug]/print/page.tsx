import { notFound, redirect } from "next/navigation";
import {
  agencySlugNeedsRedirect,
  resolveAgencyBySlug,
} from "@/lib/agencies/resolveAgencyBySlug";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/env";
import { CollateralPreview } from "@/components/collateral/CollateralPreview";
import { mergeAgencyBrandIntoCollateralDocument } from "@/lib/collateral/mergeAgencyBrand";
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
    .select("document_json, type, status")
    .eq("agency_id", agency.id)
    .eq("public_slug", collateralSlug)
    .in("status", ["generated", "published"])
    .maybeSingle();

  if (!collateral?.document_json) {
    notFound();
  }

  const document = mergeAgencyBrandIntoCollateralDocument(
    agency as Agency,
    collateral.document_json as CollateralDocumentJson,
  );

  return (
    <div className="collateral-print-root print-mode">
      <CollateralPreview
        document={document}
        collateralType={collateral.type as CollateralType}
        printMode
      />
    </div>
  );
}

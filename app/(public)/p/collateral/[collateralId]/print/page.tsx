import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasServiceRoleKey } from "@/lib/env";
import { CollateralPreview } from "@/components/collateral/CollateralPreview";
import { verifyCollateralPrintAccessToken } from "@/lib/collateral/printAccessToken";
import { mergeAgencyBrandIntoCollateralDocument } from "@/lib/collateral/mergeAgencyBrand";
import type { Agency, CollateralDocumentJson, CollateralType } from "@/lib/types";

export default async function DraftCollateralPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ collateralId: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { collateralId } = await params;
  const { token } = await searchParams;

  if (
    !hasServiceRoleKey() ||
    !token ||
    !verifyCollateralPrintAccessToken(collateralId, token)
  ) {
    notFound();
  }

  const admin = createAdminClient();
  const { data: collateral } = await admin
    .from("collateral_items")
    .select("document_json, type, agency_id")
    .eq("id", collateralId)
    .maybeSingle();

  if (!collateral?.document_json) {
    notFound();
  }

  const { data: agency } = await admin
    .from("agencies")
    .select("*")
    .eq("id", collateral.agency_id)
    .maybeSingle();

  if (!agency) {
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

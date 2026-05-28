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
  searchParams: Promise<{ token?: string; variant?: string }>;
}) {
  const { collateralId } = await params;
  const { token, variant } = await searchParams;

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
          variantId={variant}
        />
      </div>
    </>
  );
}

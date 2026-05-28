import { generateReportSlug } from "@/lib/reports/slugs";
import { getSiteUrl } from "@/lib/env";

export function generateCollateralSlug() {
  return generateReportSlug();
}

export function buildPublicCollateralPrintUrl(
  agencySlug: string,
  collateralSlug: string,
) {
  const base = getSiteUrl().replace(/\/$/, "");
  return `${base}/${agencySlug}/c/${collateralSlug}/print`;
}

export function buildPublicCollateralUrl(
  agencySlug: string,
  collateralSlug: string,
) {
  const base = getSiteUrl().replace(/\/$/, "");
  return `${base}/${agencySlug}/c/${collateralSlug}`;
}

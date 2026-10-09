import { notFound } from "next/navigation";
import { ReportPreview } from "@/components/reports/ReportPreview";
import { CollateralPreview } from "@/components/collateral/CollateralPreview";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { generateQrCodeDataUrl } from "@/lib/reports/qr";
import type { BrochureDocumentJson, BusinessCardDocumentJson } from "@/lib/collateral/templates/types";
import type { FinalReportJson } from "@/lib/types";

export const metadata = { title: "Synthetic document print check", robots: { index: false, follow: false } };

/** Synthetic records only. This route never reads or writes an account or property. */
export default async function DocumentPrintCheck({ searchParams }: { searchParams: Promise<{ kind?: string; template?: string; qr?: string }> }) {
  if (process.env.NODE_ENV !== "development" && process.env.STAYPACK_REGRESSION_PREVIEW !== "1") notFound();
  const { kind = "str", template, qr } = await searchParams;
  const fixture = createLintRegressionFixtures();
  const link = qr === "on" ? { mode: "custom" as const, url: `https://example.test/${kind}` } : { mode: "none" as const };
  const asset = link.mode === "custom" ? await generateQrCodeDataUrl(link.url) : "";
  if (kind === "business-card") {
    const document: BusinessCardDocumentJson = { ...fixture.card.document_json as BusinessCardDocumentJson, document_link: link, assets: { qr_code_url: asset } };
    return <CollateralPreview document={document} collateralType="agent_business_card" printMode />;
  }
  if (kind === "sales-brochure" || kind === "rental-brochure") {
    const document = { ...fixture.document, template_id: template ?? `${kind}-classic-2pg`, type: kind === "rental-brochure" ? "rental_brochure" : "sales_brochure", version: kind === "rental-brochure" ? "rental_brochure_v1" : "sales_brochure_v1", document_link: link, assets: { qr_code_url: asset } } as BrochureDocumentJson;
    return <CollateralPreview document={document} collateralType={document.type} printMode />;
  }
  const base = kind === "lease" ? fixture.lease : kind === "sales" ? fixture.sales : fixture.report;
  const document: FinalReportJson = { ...base.final_report_json!, template_id: template ?? base.template_id ?? "classic-detailed", document_link: link, assets: { qr_code_url: asset, pdf_url: "" } };
  return <ReportPreview report={document} printMode />;
}

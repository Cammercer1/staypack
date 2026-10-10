import { notFound } from "next/navigation";
import { ReportPreview } from "@/components/reports/ReportPreview";
import { CollateralPreview } from "@/components/collateral/CollateralPreview";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { generateQrCodeDataUrl } from "@/lib/reports/qr";
import type { BrochureDocumentJson, BusinessCardDocumentJson } from "@/lib/collateral/templates/types";
import type { FinalReportJson } from "@/lib/types";
import { buildFinalReportJson } from "@/lib/reports/buildFinalReportJson";
import { applyStrEstimateAdjustments, saveStrRateOverride } from "@/lib/reports/strEstimateAdjustments";

export const metadata = { title: "Synthetic document print check", robots: { index: false, follow: false } };

/** Synthetic records only. This route never reads or writes an account or property. */
export default async function DocumentPrintCheck({ searchParams }: { searchParams: Promise<{ kind?: string; template?: string; qr?: string; provider?: string; scenario?: string }> }) {
  if (process.env.NODE_ENV !== "development" && process.env.STAYPACK_REGRESSION_PREVIEW !== "1") notFound();
  const { kind = "str", template, qr, provider, scenario } = await searchParams;
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
  if (kind === "str" && provider === "airroi" && fixture.report.str_enrichment_json) {
    const annual = document.str.annual_revenue ?? 60000;
    document.str = { ...document.str, occupancy_rate: fixture.report.final_estimate_json?.occupancyRate ?? 72 };
    const pool = fixture.report.str_enrichment_json.comps;
    document.str_enrichment = {
      ...fixture.report.str_enrichment_json, provider: "airroi", seasonality_basis: "modelled",
      revenue_range: { p25: annual * 0.6, p50: annual, p75: annual * 1.4, p90: annual * 1.8 },
      comp_pool: pool, comps: pool.slice(0, 6), selected_comp_ids: pool.slice(0, 6).map((c) => c.listing_id),
      seasonality: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map((month) => ({ month, revenue: annual / 12, revenue_low: null, revenue_high: null, occupancy: null, adr: null, modelled: true })),
    };
  }
  if (kind === "str" && scenario === "management") {
    const preset = fixture.agency.str_management_presets!.find((preset) => preset.mode !== "relative" && preset.mode !== "uplift")!;
    const rates = { nightlyRate: preset.nightlyRate, occupancyRate: preset.occupancyRate };
    const estimate = applyStrEstimateAdjustments(fixture.report.original_estimate_json!, rates);
    const managed = buildFinalReportJson({ agency: fixture.agency, agencyAgents: [fixture.agent], listing: fixture.listing, report: { ...fixture.report, template_id: document.template_id, str_enrichment_json: document.str_enrichment ?? null, user_overrides_json: saveStrRateOverride(null, rates, preset.assumptions) }, estimate, copy: fixture.report.ai_copy_json! });
    return <ReportPreview report={{ ...managed, document_link: link, assets: document.assets }} printMode />;
  }
  return <ReportPreview report={document} printMode />;
}

"use client";
import { AppraisalGenerationStatus } from "@/components/appraisals/AppraisalGenerationStatus";
import { ReportWizard } from "@/components/reports/ReportWizard";
import { LeaseAppraisalWizard } from "@/components/lease-appraisal/LeaseAppraisalWizard";
import { SalesAppraisalWizard } from "@/components/sales-appraisal/SalesAppraisalWizard";
import { ListingWorkspace } from "@/components/listings/ListingWorkspace";
import { BusinessCardEditor } from "@/components/collateral/business-card/BusinessCardEditor";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { createLintRegressionFixtures, installRegressionMocks, type RegressionFixtures } from "./lintRegressionFixtures";
import { DashboardAnalytics } from "@/components/dashboard/DashboardAnalytics";
import { LeadsInbox } from "@/components/leads/LeadsInbox";
import { ListingImageGallery } from "@/components/listings/ListingImageGallery";
import { ListingAgentsStrip } from "@/components/listings/ListingAgentsStrip";
import { LandingTemplatePreviewModal } from "@/components/listings/LandingTemplatePreviewModal";
import { UnknownAgentsAfterScrapeModal } from "@/components/reports/UnknownAgentsAfterScrapeModal";
import { ListingScrapeProgress } from "@/components/reports/ListingScrapeProgress";
import { BrandAdvancedSettingsModal } from "@/components/settings/BrandAdvancedSettingsModal";
import { FontPicker } from "@/components/settings/FontPicker";
import { GeneratedBrochureCopyEditor } from "@/components/collateral/sales-brochure/GeneratedBrochureCopyEditor";
import { BrochureGenerationStatus } from "@/components/collateral/sales-brochure/BrochureGenerationStatus";
import { SalesBrochureWizard } from "@/components/collateral/sales-brochure/SalesBrochureWizard";
import { FittedBrochurePreview } from "@/components/collateral/sales-brochure/FittedBrochurePreview";
import { FittedReportPreview } from "@/components/reports/FittedReportPreview";
import { SocialPostLayerPanel } from "@/components/collateral/social/SocialPostLayerPanel";
import { buildSocialPostsDocument } from "@/lib/collateral/buildSocialPostsDocument";
import { salesBrochureToReportShape } from "@/lib/collateral/sales-brochure/toReportShape";
import { SALES_BROCHURE_TEMPLATES } from "@/lib/collateral/templates/sales-brochure/registry";
import { REPORT_TEMPLATES } from "@/lib/reports/templates/registry";
import { Button } from "@/components/ui/button";
import type { AgencyInput } from "@/lib/validation/schemas";

const cases = ["brochure", "sales-brochure-new", "lease-brochure-new", "brochure-generation", "editor", "wizard", "report", "gallery", "landing", "agents", "unknown-agents", "branding", "analytics", "leads", "progress", "social", "report-wizard", "str-new", "lease-wizard", "sales-wizard", "lease-new", "sales-new", "appraisal-generation", "workspace", "business-card"] as const;

export function LintRegressionPlayground() {
  const [fixtures] = useState(createLintRegressionFixtures);
  const [started, setStarted] = useState(false);
  const [selected, setSelected] = useState<string>("brochure");
  const [requests, setRequests] = useState<string[]>([]);
  const restore = useRef<(() => void) | null>(null);
  useEffect(() => () => restore.current?.(), []);

  function start() {
    restore.current = installRegressionMocks(fixtures, (label) => setRequests((items) => [...items, label]));
    setStarted(true);
  }

  return <main className="mx-auto max-w-7xl space-y-5 p-6">
    <header className="space-y-3 rounded-xl border bg-amber-50 p-4 text-slate-900">
      <h1 className="text-2xl font-semibold">StayPack mock regression preview</h1>
      <p>Synthetic listing and agency. Saves stay in this browser tab and reset on reload.</p>
      {!started ? <Button onClick={start}>Start mock test session</Button> : <label>Test screen <select aria-label="Test screen" value={selected} onChange={(e) => {
        const name = e.target.value;
        restore.current?.();
        setRequests([]);
        restore.current = installRegressionMocks(fixtures, (label) => setRequests((items) => [...items, label]), name === "str-new" ? "str" : name === "lease-new" ? "lease" : name === "sales-new" ? "sales" : name === "sales-brochure-new" ? "sales_brochure" : name === "lease-brochure-new" ? "rental_brochure" : undefined);
        setSelected(name);
      }} className="ml-3 rounded border p-2">{cases.map((name) => <option key={name}>{name}</option>)}</select></label>}
    </header>
    {started && <RegressionCase key={selected} name={selected} fixtures={fixtures} />}
    <details><summary>Mock API activity ({requests.length})</summary><pre data-testid="mock-requests">{requests.join("\n")}</pre></details>
  </main>;
}

function RegressionCase({ name, fixtures }: { name: string; fixtures: RegressionFixtures }) {
  const [leaseDraft] = useState(() => ({ ...fixtures.lease, template_id: null, final_report_json: null, status: "draft" as const }));
  const [salesDraft] = useState(() => ({ ...fixtures.sales, template_id: null, final_report_json: null, status: "draft" as const }));
  const [leaseDraftCollateral] = useState(() => ({ ...fixtures.leaseCollateral, template_id: null }));
  const [salesDraftCollateral] = useState(() => ({ ...fixtures.salesCollateral, template_id: null }));
  const [brochureDraft] = useState(() => ({ ...fixtures.collateral, type: name === "lease-brochure-new" ? "rental_brochure" as const : "sales_brochure" as const, template_id: null, document_json: null, status: "draft" as const }));
  const [listing, setListing] = useState(fixtures.listing);
  const [collateral, setCollateral] = useState(fixtures.collateral);
  const [agency, setAgency] = useState(fixtures.agency);
  const [templateId, setTemplateId] = useState(fixtures.document.template_id);
  const [reportTemplate, setReportTemplate] = useState(REPORT_TEMPLATES[0].id);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(false);
  const [completion, setCompletion] = useState("");
  const [social, setSocial] = useState(() => buildSocialPostsDocument({ agency, listing, collateral: { ...collateral, type: "social_posts", template_id: null }, agentProfile: fixtures.agent }));
  const form = useForm<AgencyInput>({ defaultValues: { name: agency.name, slug: agency.slug, website_url: agency.website_url ?? "", email: agency.email ?? "", primary_colour: agency.primary_colour, text_colour: agency.text_colour, heading_font_family: agency.heading_font_family, body_font_family: agency.body_font_family } });
  const document = { ...fixtures.document, template_id: templateId };
  const report = { ...salesBrochureToReportShape(fixtures.document), template_id: reportTemplate };

  if (name === "sales-brochure-new" || name === "lease-brochure-new") return <SalesBrochureWizard agency={agency} initialListing={listing} initialCollateral={brochureDraft} collateralType={brochureDraft.type} initialAgencyAgents={[fixtures.agent]} />;
  if (name === "brochure-generation") return <BrochureGenerationStatus />;
  if (name === "str-new") return <ReportWizard agency={agency} initialListing={listing} initialReport={{ ...fixtures.report, template_id: null, final_estimate_json: null, final_report_json: null, ai_copy_json: null, str_enrichment_json: null, status: "draft" }} />;
  if (name === "report-wizard") return <ReportWizard agency={agency} initialListing={listing} initialReport={fixtures.report} />;
  if (name === "lease-wizard") return <LeaseAppraisalWizard agency={agency} initialListing={listing} initialReport={fixtures.lease} initialCollateral={fixtures.leaseCollateral} initialAgencyAgents={[fixtures.agent]} />;
  if (name === "sales-wizard") return <SalesAppraisalWizard agency={agency} initialListing={listing} initialReport={fixtures.sales} initialCollateral={fixtures.salesCollateral} initialAgencyAgents={[fixtures.agent]} />;
  if (name === "lease-new") return <LeaseAppraisalWizard agency={agency} initialListing={listing} initialReport={leaseDraft} initialCollateral={leaseDraftCollateral} initialAgencyAgents={[fixtures.agent]} />;
  if (name === "sales-new") return <SalesAppraisalWizard agency={agency} initialListing={listing} initialReport={salesDraft} initialCollateral={salesDraftCollateral} initialAgencyAgents={[fixtures.agent]} />;
  if (name === "appraisal-generation") return <AppraisalGenerationStatus />;
  if (name === "workspace") return <ListingWorkspace agencySlug={agency.slug} listing={listing} collateral={[collateral]} leads={[]} reports={[fixtures.report]} stats={{ total_views: 15, views_last_30d: 10, total_leads: 3 }} />;
  if (name === "business-card") return <BusinessCardEditor initialCards={[fixtures.card]} agents={[fixtures.agent]} listings={[listing]} />;
  if (name === "brochure") return <section data-testid="brochure">
    <label>Brochure template <select aria-label="Brochure template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>{SALES_BROCHURE_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.label} ({t.pages} pages)</option>)}</select></label>
    <FittedBrochurePreview document={document} useDocumentBrand />
  </section>;
  if (name === "editor") return <GeneratedBrochureCopyEditor agency={agency} listing={listing} collateral={collateral} agencyAgents={[fixtures.agent]} onCollateralChange={setCollateral} onContinueToPreview={() => setCompletion("Preview ready")} />;
  if (name === "wizard") return <SalesBrochureWizard agency={agency} initialListing={listing} initialCollateral={collateral} />;
  if (name === "report") return <section data-testid="report">
    <label>Report template <select aria-label="Report template" value={reportTemplate} onChange={(e) => setReportTemplate(e.target.value)}>{REPORT_TEMPLATES.slice(0, 2).map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
    <FittedReportPreview report={report} editable={{ setField: (_path, value) => setCompletion(value), openImagePicker: () => {} }} />
    <output data-testid="edited-report">{completion}</output>
  </section>;
  if (name === "gallery") return <ListingImageGallery images={fixtures.document.property.selected_image_urls} address={listing.property_address ?? "Mock property"} />;
  if (name === "landing") return <LandingTemplatePreviewModal listingId={listing.id} agencySlug="dev/lint-regression" listingSlug="mock" savedTemplate={listing.landing_template} />;
  if (name === "agents") return <ListingAgentsStrip listing={listing} onUpdated={setListing} />;
  if (name === "unknown-agents") return <section><Button onClick={() => setOpen(true)}>Review scraped agents</Button><UnknownAgentsAfterScrapeModal open={open} agents={[{ name: "Mock New Agent", phone: "0400000001" }]} onComplete={(result) => { setCompletion(JSON.stringify(result)); setOpen(false); }} /><output data-testid="completion">{completion}</output></section>;
  if (name === "branding") return <section><Button onClick={() => setOpen(true)}>Advanced settings</Button><BrandAdvancedSettingsModal open={open} onOpenChange={setOpen} agency={agency} form={form} onSaved={setAgency} /><FontPicker form={form} agencyId={agency.id} /></section>;
  if (name === "analytics") return <DashboardAnalytics activeListings={3} />;
  if (name === "leads") return <LeadsInbox initialLeads={[fixtures.lead]} />;
  if (name === "progress") return <section><Button onClick={() => { setActive(true); window.setTimeout(() => setActive(false), 1500); }}>Run mock import</Button><ListingScrapeProgress active={active}><p>Mock listing form</p></ListingScrapeProgress></section>;
  if (name === "social") return <SocialPostLayerPanel document={social} listing={listing} backgroundOptions={fixtures.document.property.selected_image_urls} onChange={setSocial} />;
  return null;
}

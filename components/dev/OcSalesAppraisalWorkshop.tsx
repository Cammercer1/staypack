import Image from "next/image";
import Link from "next/link";
import { OcSalesAppraisalConceptPreview } from "@/components/dev/OcSalesAppraisalConceptPreview";
import { FittedReportPreview } from "@/components/reports/FittedReportPreview";
import type { Agency, FinalReportJson, Listing, Report } from "@/lib/types";

type Props = {
  listing: Listing;
  report: Report;
  agency: Agency;
  baseReport: FinalReportJson;
};

type TokenRowProps = {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
};

const currency = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

function TokenRow({ label, value, mono = false }: TokenRowProps) {
  const displayValue = value === null || value === undefined || value === "" ? "—" : value;

  return (
    <div className="grid grid-cols-[7.25rem_minmax(0,1fr)] gap-3 border-b border-neutral-200 py-2 last:border-b-0">
      <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-neutral-500">
        {label}
      </dt>
      <dd
        className={
          mono
            ? "min-w-0 break-all font-mono text-[0.72rem] leading-5 text-neutral-700"
            : "min-w-0 break-words text-sm leading-5 text-neutral-900"
        }
      >
        {displayValue}
      </dd>
    </div>
  );
}

function TokenSection({
  title,
  summary,
  children,
  open = false,
}: {
  title: string;
  summary: string;
  children: React.ReactNode;
  open?: boolean;
}) {
  return (
    <details open={open} className="group rounded-xl border border-neutral-200 bg-white">
      <summary className="cursor-pointer list-none px-4 py-3 marker:content-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-neutral-950">{title}</h2>
            <p className="mt-0.5 text-xs leading-5 text-neutral-500">{summary}</p>
          </div>
          <span className="mt-0.5 text-lg leading-none text-neutral-400 transition-transform group-open:rotate-45">
            +
          </span>
        </div>
      </summary>
      <div className="border-t border-neutral-200 px-4 py-2">{children}</div>
    </details>
  );
}

function ColourToken({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-neutral-200 py-2 last:border-b-0">
      <span
        aria-hidden="true"
        className="h-8 w-8 shrink-0 rounded-md border border-black/10"
        style={{ backgroundColor: value }}
      />
      <div className="min-w-0">
        <p className="text-xs font-medium text-neutral-900">{label}</p>
        <p className="font-mono text-[0.7rem] text-neutral-500">{value}</p>
      </div>
    </div>
  );
}

function ImageToken({ label, url }: { label: string; url: string }) {
  return (
    <div className="space-y-2 border-b border-neutral-200 py-3 last:border-b-0">
      <p className="text-xs font-semibold text-neutral-800">{label}</p>
      <div className="relative aspect-[16/9] overflow-hidden rounded-lg bg-neutral-100">
        <Image src={url} alt="" fill unoptimized className="object-cover" sizes="360px" />
      </div>
      <p className="break-all font-mono text-[0.65rem] leading-4 text-neutral-500">{url}</p>
    </div>
  );
}

export function OcSalesAppraisalWorkshop({
  listing,
  report,
  agency,
  baseReport,
}: Props) {
  const estimate = baseReport.sale_estimate;
  const comps = baseReport.sales_enrichment?.comps ?? [];
  const selectedImages = baseReport.property.selected_image_urls.filter(Boolean);
  const brandAdvanced = baseReport.agency.brand_advanced ?? agency.brand_advanced_json;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-950">
      <header className="border-b border-white/10 bg-neutral-950 px-5 py-4 text-white">
        <div className="mx-auto flex max-w-[1800px] flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-amber-300 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-neutral-950">
                Dev workshop
              </span>
              <span className="text-xs text-neutral-400">Separate from the app workflow</span>
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-tight">
              OC Real Estate · Property appraisal
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              {baseReport.property.address} — working OC concept with live report tokens.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link
              href={`/listings/${listing.id}/sales-appraisal`}
              className="rounded-lg border border-white/15 px-3 py-2 text-neutral-200 transition hover:bg-white/10"
            >
              Open app screen
            </Link>
            <span className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-emerald-200">
              No OC template applied
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1800px] gap-5 p-5 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[430px_minmax(0,1fr)]">
        <aside className="space-y-3 lg:max-h-[calc(100vh-7.25rem)] lg:overflow-y-auto lg:pr-1">
          <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-amber-900">Change log</p>
            <div className="mt-2 space-y-2 text-sm leading-6 text-amber-950">
              <p>
                <strong>Concept v1:</strong> photo-led page one based on the supplied OC reference.
              </p>
              <ul className="list-disc space-y-1 pl-5">
                <li>Large hero with a two-image gallery strip.</li>
                <li>Cream editorial information panel.</li>
                <li>OC logo aligned right, directly beneath the gallery.</li>
                <li>Page one contains a short property paragraph and compact highlight bullets.</li>
                <li>OC-only comparable cards and appraisal evidence on page two.</li>
              </ul>
              <p className="text-xs leading-5 text-amber-800">
                Workshop preview only. No template registration or report selection has changed.
              </p>
            </div>
          </div>

          <TokenSection title="Source IDs" summary="The exact live records powering this workshop" open>
            <dl>
              <TokenRow label="Listing" value={listing.id} mono />
              <TokenRow label="Report" value={report.id} mono />
              <TokenRow label="Agency" value={agency.id} mono />
              <TokenRow label="Template" value={baseReport.template_id} mono />
              <TokenRow label="Version" value={baseReport.version} mono />
              <TokenRow label="Generated" value={baseReport.generated_at} mono />
            </dl>
          </TokenSection>

          <TokenSection title="Brand tokens" summary="OC colours, typography, logo and contact data" open>
            <div className="grid grid-cols-2 gap-x-3">
              <ColourToken label="Primary" value={baseReport.agency.primary_colour} />
              <ColourToken label="Secondary" value={baseReport.agency.secondary_colour} />
              <ColourToken label="Accent" value={baseReport.agency.accent_colour} />
              <ColourToken label="Text" value={baseReport.agency.text_colour} />
              <ColourToken label="Background" value={baseReport.agency.background_colour} />
              <ColourToken
                label="Callout heading"
                value={baseReport.agency.callout_heading_colour ?? baseReport.agency.text_colour}
              />
            </div>
            <dl className="mt-2 border-t border-neutral-200">
              <TokenRow label="Heading font" value={baseReport.agency.heading_font_family} />
              <TokenRow label="Body font" value={baseReport.agency.body_font_family} />
              <TokenRow label="Heading file" value={baseReport.agency.heading_font_file_url} mono />
              <TokenRow label="Body file" value={baseReport.agency.body_font_file_url} mono />
              <TokenRow label="Light logo" value={baseReport.agency.logo_light_url} mono />
              <TokenRow label="Dark logo" value={baseReport.agency.logo_dark_url} mono />
              <TokenRow label="Website" value={baseReport.agency.website_url} mono />
              <TokenRow label="Phone" value={baseReport.agency.phone} />
              <TokenRow label="Email" value={baseReport.agency.email} />
              <TokenRow
                label="Advanced"
                value={brandAdvanced ? JSON.stringify(brandAdvanced, null, 2) : null}
                mono
              />
            </dl>
          </TokenSection>

          <TokenSection title="Property tokens" summary="Address, features and listing source copy" open>
            <dl>
              <TokenRow label="Address" value={baseReport.property.address} />
              <TokenRow label="Suburb" value={baseReport.property.suburb} />
              <TokenRow label="State" value={baseReport.property.state} />
              <TokenRow label="Postcode" value={baseReport.property.postcode} />
              <TokenRow label="Type" value={baseReport.property.property_type} />
              <TokenRow label="Bedrooms" value={baseReport.property.bedrooms} />
              <TokenRow label="Bathrooms" value={baseReport.property.bathrooms} />
              <TokenRow label="Car spaces" value={baseReport.property.car_spaces} />
              <TokenRow label="Display price" value={baseReport.property.display_price} />
              <TokenRow label="Listing URL" value={baseReport.property.listing_url} mono />
              <TokenRow label="Summary" value={baseReport.property.summary} />
            </dl>
          </TokenSection>

          <TokenSection title="Sales estimate" summary="The live appraisal price band" open>
            <dl>
              <TokenRow
                label="Minimum"
                value={estimate?.price_min == null ? null : currency.format(estimate.price_min)}
              />
              <TokenRow
                label="Midpoint"
                value={estimate?.price_midpoint == null ? null : currency.format(estimate.price_midpoint)}
              />
              <TokenRow
                label="Maximum"
                value={estimate?.price_max == null ? null : currency.format(estimate.price_max)}
              />
            </dl>
          </TokenSection>

          <TokenSection title="Copy tokens" summary="Every text field currently available to the template" open>
            <dl>
              <TokenRow label="Heading" value={baseReport.copy.heading} />
              <TokenRow label="Blurb" value={baseReport.copy.blurb} />
              <TokenRow label="Metric line" value={baseReport.copy.key_metrics_line} />
              <TokenRow label="Appeal points" value={baseReport.copy.appeal_points.join(" · ")} />
              <TokenRow
                label="Supporting"
                value={baseReport.copy.supporting_factors.join(" · ")}
              />
              <TokenRow label="Evidence" value={baseReport.copy.comparable_evidence} />
              <TokenRow label="Methodology" value={baseReport.copy.methodology_note} />
              <TokenRow label="CTA" value={baseReport.copy.cta} />
              <TokenRow label="Disclaimer" value={baseReport.copy.disclaimer} />
              <TokenRow
                label="Comp note"
                value={baseReport.copy.comparable_disclaimer}
              />
            </dl>
          </TokenSection>

          <TokenSection
            title={`Images (${selectedImages.length})`}
            summary="The selected image slots currently available to the report"
          >
            <ImageToken label="Hero image" url={baseReport.property.hero_image_url} />
            {selectedImages.map((url, index) => (
              <ImageToken key={`${url}-${index}`} label={`Selected image ${index + 1}`} url={url} />
            ))}
          </TokenSection>

          <TokenSection
            title={`Agents (${baseReport.agents.length})`}
            summary="The agent profiles attached to this report"
          >
            {baseReport.agents.map((agent, index) => (
              <dl key={`${agent.email}-${index}`} className="border-b border-neutral-200 py-2 last:border-b-0">
                <TokenRow label="Name" value={agent.name} />
                <TokenRow label="Role" value={agent.role_title} />
                <TokenRow label="Phone" value={agent.phone} />
                <TokenRow label="Email" value={agent.email} />
                <TokenRow label="Photo" value={agent.photo_url} mono />
              </dl>
            ))}
          </TokenSection>

          <TokenSection
            title={`Comparables (${comps.length})`}
            summary={`${baseReport.sales_enrichment?.sold_comp_count ?? 0} sold and ${baseReport.sales_enrichment?.for_sale_comp_count ?? 0} for sale in the source set`}
          >
            {comps.map((comp, index) => (
              <dl key={`${comp.listing_id}-${index}`} className="border-b border-neutral-200 py-2 last:border-b-0">
                <TokenRow label="Address" value={comp.name} />
                <TokenRow label="Status" value={comp.sale_status} />
                <TokenRow label="Price" value={comp.price_display ?? comp.price} />
                <TokenRow label="Sold date" value={comp.sold_date} />
                <TokenRow label="Property type" value={comp.property_type} />
                <TokenRow label="Bedrooms" value={comp.bedrooms} />
                <TokenRow label="Bathrooms" value={comp.bathrooms} />
                <TokenRow label="Car spaces" value={comp.car_spaces} />
                <TokenRow label="Image" value={comp.thumbnail_url} mono />
                <TokenRow label="URL" value={comp.listing_url} mono />
              </dl>
            ))}
          </TokenSection>

          <TokenSection title="Raw template payload" summary="The complete final_report_json used by report templates">
            <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap break-all py-2 font-mono text-[0.65rem] leading-5 text-neutral-700">
              {JSON.stringify(baseReport, null, 2)}
            </pre>
          </TokenSection>
        </aside>

        <section className="min-w-0 rounded-2xl bg-neutral-200 p-3 sm:p-5 lg:h-[calc(100vh-7.25rem)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-neutral-500">Working preview</p>
              <p className="text-sm text-neutral-700">OC property appraisal · concept v1 · two-page working document</p>
            </div>
            <p className="rounded-full bg-white px-3 py-1.5 font-mono text-[0.65rem] text-neutral-600 shadow-sm">
              workshop-only
            </p>
          </div>
          <OcSalesAppraisalConceptPreview report={baseReport} />

          <details className="mt-3 rounded-xl border border-neutral-300 bg-white/80">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-neutral-700">
              Compare with current Classic baseline
            </summary>
            <div className="border-t border-neutral-300 p-3">
              <FittedReportPreview
                report={baseReport}
                className="border-neutral-300"
                maxHeight="42rem"
              />
            </div>
          </details>
        </section>
      </main>
    </div>
  );
}

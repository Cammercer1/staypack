import Image from "next/image";
import Link from "next/link";
import { OcStrAppraisalConceptPreview } from "@/components/dev/OcStrAppraisalConceptPreview";
import { FittedReportPreview } from "@/components/reports/FittedReportPreview";
import { formatCurrency, formatDistanceMeters, formatPercent } from "@/lib/reports/formatters";
import type { Agency, FinalReportJson, Listing, Report } from "@/lib/types";

type Props = {
  listing: Listing;
  report: Report;
  agency: Agency;
  baseReport: FinalReportJson;
};

function TokenRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string | number | null | undefined;
  mono?: boolean;
}) {
  const displayValue = value === null || value === undefined || value === "" ? "—" : value;
  return (
    <div className="grid grid-cols-[7.25rem_minmax(0,1fr)] gap-3 border-b border-neutral-200 py-2 last:border-b-0">
      <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.08em] text-neutral-500">
        {label}
      </dt>
      <dd className={mono ? "min-w-0 break-all font-mono text-[0.72rem] leading-5 text-neutral-700" : "min-w-0 break-words text-sm leading-5 text-neutral-900"}>
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
          <span className="mt-0.5 text-lg leading-none text-neutral-400 transition-transform group-open:rotate-45">+</span>
        </div>
      </summary>
      <div className="border-t border-neutral-200 px-4 py-2">{children}</div>
    </details>
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

export function OcStrAppraisalWorkshop({ listing, report, agency, baseReport }: Props) {
  const comps = baseReport.str_enrichment?.comps ?? [];
  const seasonality = baseReport.str_enrichment?.seasonality ?? [];
  const images = baseReport.property.selected_image_urls.filter(Boolean);

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-950">
      <header className="border-b border-white/10 bg-neutral-950 px-5 py-4 text-white">
        <div className="mx-auto flex max-w-[1800px] flex-col justify-between gap-4 xl:flex-row xl:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-amber-300 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-neutral-950">Dev workshop</span>
              <span className="text-xs text-neutral-400">Separate from the live OC workflow</span>
            </div>
            <h1 className="mt-2 text-xl font-semibold tracking-tight">OC Real Estate · STR appraisal</h1>
            <p className="mt-1 text-sm text-neutral-400">
              {baseReport.property.address} — OC concept using the published STR estimate and market evidence.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link
              href={`/listings/${listing.id}/reports/${report.id}`}
              className="rounded-lg border border-white/15 px-3 py-2 text-neutral-200 transition hover:bg-white/10"
            >
              Open current STR wizard
            </Link>
            <span className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-amber-100">Workshop only · not assigned</span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1800px] gap-5 p-5 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[430px_minmax(0,1fr)]">
        <aside className="space-y-3 lg:max-h-[calc(100vh-7.25rem)] lg:overflow-y-auto lg:pr-1">
          <div className="rounded-xl border border-amber-300/60 bg-amber-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.1em] text-amber-900">Concept v1</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-amber-950">
              <li>Same OC photo-led cover and cream editorial panel.</li>
              <li>Headline callout uses estimated gross STR revenue.</li>
              <li>Nightly rate, occupancy and guest capacity replace sale-property specs.</li>
              <li>Page two combines revenue, seasonality and nearby short-stay comparables.</li>
              <li>Nothing has been assigned to the OC account yet.</li>
            </ul>
          </div>

          <TokenSection title="Source IDs" summary="The live records powering this workshop" open>
            <dl>
              <TokenRow label="Listing" value={listing.id} mono />
              <TokenRow label="Report" value={report.id} mono />
              <TokenRow label="Agency" value={agency.id} mono />
              <TokenRow label="Template" value={baseReport.template_id} mono />
              <TokenRow label="Version" value={baseReport.version} mono />
            </dl>
          </TokenSection>

          <TokenSection title="STR estimate" summary="Live adjusted report figures" open>
            <dl>
              <TokenRow label="Annual gross" value={formatCurrency(baseReport.str.annual_revenue)} />
              <TokenRow label="Monthly" value={formatCurrency(baseReport.str.monthly_revenue)} />
              <TokenRow label="Weekly" value={formatCurrency(baseReport.str.weekly_revenue)} />
              <TokenRow label="Nightly" value={formatCurrency(baseReport.str.nightly_rate)} />
              <TokenRow label="Occupancy" value={formatPercent(baseReport.str.occupancy_rate)} />
              <TokenRow label="Booked nights" value={baseReport.str.booked_nights} />
              <TokenRow label="Radius" value={formatDistanceMeters(baseReport.str.radius_m)} />
            </dl>
          </TokenSection>

          <TokenSection title="Property and copy" summary="Page-one report tokens" open>
            <dl>
              <TokenRow label="Address" value={baseReport.property.address} />
              <TokenRow label="Type" value={baseReport.property.property_type} />
              <TokenRow label="Bedrooms" value={baseReport.property.bedrooms} />
              <TokenRow label="Bathrooms" value={baseReport.property.bathrooms} />
              <TokenRow label="Guests" value={baseReport.property.accommodates} />
              <TokenRow label="Heading" value={baseReport.copy.heading} />
              <TokenRow label="Page 1 blurb" value={baseReport.copy.blurb_variants?.short || baseReport.copy.blurb} />
              <TokenRow label="Full blurb" value={baseReport.copy.blurb} />
              <TokenRow label="Highlights" value={baseReport.copy.appeal_points.join(" · ")} />
              <TokenRow label="Metric line" value={baseReport.copy.key_metrics_line} />
              <TokenRow label="Methodology" value={baseReport.copy.methodology_note} />
              <TokenRow label="Disclaimer" value={baseReport.copy.disclaimer} />
            </dl>
          </TokenSection>

          <TokenSection title={`Market evidence (${comps.length})`} summary={`${seasonality.length} seasonality months and selected nearby comparables`} open>
            {comps.map((comp) => (
              <dl key={comp.listing_id || comp.name} className="border-b border-neutral-200 py-2 last:border-b-0">
                <TokenRow label="Name" value={comp.name} />
                <TokenRow label="Annual gross" value={formatCurrency(comp.annual_revenue)} />
                <TokenRow label="Nightly" value={formatCurrency(comp.nightly_rate)} />
                <TokenRow label="Occupancy" value={formatPercent(comp.occupancy_rate)} />
                <TokenRow label="Distance" value={formatDistanceMeters(comp.distance_m)} />
              </dl>
            ))}
          </TokenSection>

          <TokenSection title={`Images (${images.length})`} summary="Selected report images">
            <ImageToken label="Hero image" url={baseReport.property.hero_image_url} />
            {images.slice(1).map((url, index) => (
              <ImageToken key={url} label={`Supporting image ${index + 1}`} url={url} />
            ))}
          </TokenSection>

          <TokenSection title="Raw template payload" summary="Complete final_report_json">
            <pre className="max-h-[36rem] overflow-auto whitespace-pre-wrap break-all py-2 font-mono text-[0.65rem] leading-5 text-neutral-700">
              {JSON.stringify(baseReport, null, 2)}
            </pre>
          </TokenSection>
        </aside>

        <section className="min-w-0 rounded-2xl bg-neutral-200 p-3 sm:p-5 lg:h-[calc(100vh-7.25rem)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-neutral-500">Working preview</p>
              <p className="text-sm text-neutral-700">OC STR appraisal · concept v1 · two-page working document</p>
            </div>
            <p className="rounded-full bg-white px-3 py-1.5 font-mono text-[0.65rem] text-neutral-600 shadow-sm">workshop-only</p>
          </div>

          <OcStrAppraisalConceptPreview report={baseReport} />

          <details className="mt-3 rounded-xl border border-neutral-300 bg-white/80">
            <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-neutral-700">Compare with current Minimalist baseline</summary>
            <div className="border-t border-neutral-300 p-3">
              <FittedReportPreview report={baseReport} className="border-neutral-300" maxHeight="42rem" />
            </div>
          </details>
        </section>
      </main>
    </div>
  );
}

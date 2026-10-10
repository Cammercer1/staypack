"use client";

import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { ComparableFilters } from "@/components/appraisals/ComparableFilters";
import { MAX_STR_FEATURED_COMPS } from "@/lib/str/comparables";
import { DocumentStepHeader } from "@/components/documents/DocumentStepHeader";
import {
  applyStrEstimateAdjustments,
  resolveStrRevenueBand,
  reconcileStrEstimate,
  strRateInputsSchema,
  readStrRateOverride,
} from "@/lib/reports/strEstimateAdjustments";
import { formatCurrency, formatPercent } from "@/lib/reports/formatters";
import { jsonRequest, reportRequest } from "@/lib/reports/reportRequests";
import { DEFAULT_DISCLAIMER, type Listing, type Report } from "@/lib/types";

function controlValues(report: Report) {
  const estimate = report.final_estimate_json;
  const reconciled = estimate && (report.user_overrides_json?.strAdjustment ? estimate : reconcileStrEstimate(estimate));
  return {
    nightlyRate: reconciled?.nightlyRate == null ? "" : String(Number(reconciled.nightlyRate.toFixed(2))),
    occupancyRate: reconciled?.occupancyRate == null ? "" : String(Number(reconciled.occupancyRate.toFixed(2))),
  };
}

export type StrEstimateHandle = {
  savePendingEdits: () => Promise<Report | null>;
};
export const StrEstimateStep = forwardRef<
  StrEstimateHandle,
  {
    listing: Listing;
    report: Report;
    busy: boolean;
    onComplete: (report: Report) => void;
    onContinue: () => void;
    onBack: () => void;
  }
>(function StrEstimateStep(
  { listing, report, busy, onComplete, onContinue, onBack },
  ref,
) {
  const estimate = report.final_estimate_json;
  const enrichment = report.str_enrichment_json;
  const initialValues = controlValues(report);
  const { register, control, setValue, reset } = useForm({ defaultValues: initialValues });
  const nightlyRate = useWatch({ control, name: "nightlyRate" });
  const occupancy = useWatch({ control, name: "occupancyRate" });
  const [resetPending, setResetPending] = useState(false);
  const baseline = report.original_estimate_json ? reconcileStrEstimate(report.original_estimate_json) : null;
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const comps = enrichment?.comp_pool ?? enrichment?.comps ?? [];
  const savedIds = (enrichment?.selected_comp_ids ?? enrichment?.comps.map((comp) => comp.listing_id) ?? []).slice(0, MAX_STR_FEATURED_COMPS);
  const [selectedIds, setSelectedIds] = useState(() => savedIds.slice(0, MAX_STR_FEATURED_COMPS));
  const selectionDirty = JSON.stringify(savedIds) !== JSON.stringify(selectedIds);
  const fetchedAt = enrichment?.fetched_at ?? report.airbtics_fetched_at;
  function toggleComp(id: string) {
    setError(null);
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter((item) => item !== id));
    else if (selectedIds.length < MAX_STR_FEATURED_COMPS) setSelectedIds([...selectedIds, id]);
    else setError("Select up to six comparables. Deselect one to replace it.");
  }
  const band = useMemo(
    () => resolveStrRevenueBand(enrichment, estimate),
    [enrichment, estimate],
  );
  const parsed = strRateInputsSchema.safeParse({
    nightlyRate: nightlyRate.trim() ? Number(nightlyRate) : NaN,
    occupancyRate: occupancy.trim() ? Number(occupancy) : NaN,
  });
  const valid = parsed.success;
  const dirty = resetPending || nightlyRate !== initialValues.nightlyRate || occupancy !== initialValues.occupancyRate;
  const adjusted = resetPending ? baseline : estimate && parsed.success && dirty
    ? applyStrEstimateAdjustments(estimate, parsed.data) : estimate;
  const agentAdjusted = !resetPending && (dirty || !!readStrRateOverride(report));
  const delta = adjusted?.annualRevenue != null && baseline?.annualRevenue != null
    ? adjusted.annualRevenue - baseline.annualRevenue : null;
  useImperativeHandle(ref, () => ({
    savePendingEdits: async () => {
      setError(null);
      if (!dirty && !selectionDirty) return report;
      if (!adjusted || !valid || (comps.length > 0 && selectedIds.length === 0)) {
        setError(
          "Enter ADR above $0 and up to $100,000, occupancy from 0% to 100%, and select at least one available comparable.",
        );
        return null;
      }
      try {
        const payload = await reportRequest<{ report: Report }>(
          `/api/reports/${report.id}`,
          jsonRequest(
            {
              ...(selectionDirty && comps.length ? { selected_comp_listing_ids: selectedIds } : {}),
              ...(dirty ? { str_adjustment: resetPending ? { mode: "baseline" } : {
                mode: "rates", nightlyRate: Number(nightlyRate), occupancyRate: Number(occupancy),
              } } : {}),
            },
            "PATCH",
          ),
        );
        reset(controlValues(payload.report));
        setResetPending(false);
        onComplete(payload.report);
        return payload.report;
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to save your figures. Try again.",
        );
        return null;
      }
    },
  }));
  if (!adjusted) return null;
  const shownComps = comps.filter((comp) => (!selectedOnly || selectedIds.includes(comp.listing_id)) &&
    `${comp.name} ${comp.suburb ?? ""} ${comp.property_type ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <section data-theme="staypack-workspace" className="space-y-5">
      <DocumentStepHeader
        title="Review the estimate & evidence"
        description="Check the market evidence and figures before writing your report."
        status={
          <span className="du-badge du-badge-sm">
            {dirty || selectionDirty ? "Unsaved changes" : "Saved figures"}
          </span>
        }
      >
        <button
          type="button"
          className="du-btn du-btn-outline min-h-11"
          disabled={busy}
          onClick={onBack}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Property & design
        </button>
        <button
          type="button"
          className="du-btn du-btn-primary min-h-11 h-auto py-3 whitespace-normal"
          disabled={busy || !valid || (comps.length > 0 && selectedIds.length === 0)}
          onClick={onContinue}
        >
          {report.final_report_json
            ? "Use figures & edit report"
            : "Use estimate & generate report"}
          <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
        </button>
      </DocumentStepHeader>
      {error ? (
        <p role="alert" className="du-alert du-alert-error du-alert-soft">
          {error}
        </p>
      ) : null}
      <div className="du-card du-card-border bg-base-100">
        <div className="du-card-body gap-5 p-5 sm:p-6">
          <div className="flex flex-wrap justify-between gap-2 text-sm text-muted-foreground">
            <p>
              {listing.property_address} · {listing.bedrooms} bed ·{" "}
              {listing.bathrooms} bath · {listing.accommodates} guests
            </p>
            {fetchedAt ? (
              <p>
                Updated{" "}
                {new Date(fetchedAt).toLocaleDateString(
                  "en-AU",
                )}
              </p>
            ) : null}
          </div>
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <div className="rounded-xl bg-base-200/60 p-5 sm:p-6" aria-live="polite" aria-atomic="true">
              <span className="du-badge du-badge-sm du-badge-outline mb-4">
                {agentAdjusted ? "Agent-adjusted estimate" : "Market estimate"}
              </span>
              <p className="text-sm font-medium">Estimated gross STR revenue</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
                {valid ? formatCurrency(adjusted.annualRevenue) : "—"}
                <span className="ml-2 text-sm font-normal text-muted-foreground">/ year</span>
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                {valid ? `${formatCurrency(adjusted.monthlyRevenue)} / month · About ${adjusted.bookedNights} booked nights` : "Complete both assumptions to preview your estimate."}
              </p>
              {baseline?.annualRevenue != null && delta != null ? (
                <div className="mt-5 border-t border-base-300 pt-4 text-sm">
                  <p>Market baseline <strong className="tabular-nums">{formatCurrency(baseline.annualRevenue)}</strong> / year</p>
                  {agentAdjusted && valid ? <p className="mt-1 text-muted-foreground">
                    {delta === 0 ? "Same annual estimate as the baseline" : `${delta > 0 ? "+" : "−"}${formatCurrency(Math.abs(delta))} (${Math.abs(delta / (baseline.annualRevenue || 1) * 100).toFixed(1)}%) ${delta > 0 ? "above" : "below"} baseline`}
                  </p> : null}
                </div>
              ) : null}
              <p className="mt-5 text-xs leading-relaxed text-muted-foreground">
                Before management fees, cleaning, furnishing and other operating costs.
              </p>
            </div>
            <fieldset disabled={busy || !baseline} className="min-w-0 space-y-5">
              <div>
                <h3 className="font-semibold">Adjust your assumptions</h3>
                <p className="mt-1 text-sm text-muted-foreground">Set the nightly rate and share of nights booked. Annual revenue updates as you adjust either one.</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="str-adr" className="text-sm font-medium">Average daily rate · ADR ($)</label>
                  <input id="str-adr" type="number" inputMode="decimal" min="0.01" max="100000" step="0.01"
                    className="du-input w-full tabular-nums" aria-describedby="str-adr-help"
                    {...register("nightlyRate", { onChange: () => setResetPending(false) })} />
                  <input type="range" aria-label="Adjust ADR" min="1"
                    max={Math.max(1000, Math.ceil((baseline?.nightlyRate ?? 500) * 2 / 100) * 100, Number(nightlyRate) || 0)} step="1"
                    value={Number(nightlyRate) || 1} onChange={(event) => { setResetPending(false); setValue("nightlyRate", event.target.value); }}
                    className="h-6 w-full accent-primary" />
                  <p id="str-adr-help" className="text-xs text-muted-foreground">Gross revenue per booked night.</p>
                </div>
                <div className="space-y-2">
                  <label htmlFor="str-occupancy" className="text-sm font-medium">Estimated occupancy (%)</label>
                  <input id="str-occupancy" type="number" inputMode="decimal" min="0" max="100" step="0.01"
                    className="du-input w-full tabular-nums" aria-describedby="str-occupancy-help"
                    {...register("occupancyRate", { onChange: () => setResetPending(false) })} />
                  <input type="range" aria-label="Adjust estimated occupancy" min="0" max="100" step="0.5"
                    value={Number(occupancy) || 0} onChange={(event) => { setResetPending(false); setValue("occupancyRate", event.target.value); }}
                    className="h-6 w-full accent-primary" />
                  <p id="str-occupancy-help" className="text-xs text-muted-foreground">Percentage of all 365 nights booked.</p>
                </div>
              </div>
              <p className="rounded-lg border border-base-300 p-3 text-sm tabular-nums">
                ADR × occupancy × 365 = estimated annual gross revenue
              </p>
              {!valid ? <p role="alert" className="text-sm text-destructive">Enter ADR above $0 and up to $100,000, and occupancy between 0% and 100%.</p> : null}
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="du-btn du-btn-sm du-btn-outline min-h-11"
                  onClick={() => {
                    if (!baseline) return;
                    reset(controlValues({ ...report, final_estimate_json: baseline, user_overrides_json: null }));
                    setResetPending(true);
                  }}>Reset to market baseline</button>
                <p className="text-xs text-muted-foreground">Saved when you continue or change steps.</p>
              </div>
              {!baseline ? <p className="text-sm text-muted-foreground">This older report has no saved market baseline for adjustments.</p> : null}
            </fieldset>
          </div>
          <details className="border-t border-base-300 pt-4 text-sm">
            <summary className="cursor-pointer font-medium">How these figures work</summary>
            <div className="mt-3 space-y-2 leading-relaxed text-muted-foreground">
              <p>The starting ADR is reconciled to the market annual estimate and occupancy. It is an effective gross rate per booked night and may differ from an advertised nightly price. Displayed figures are rounded.</p>
              <p>Changing ADR holds occupancy steady; changing occupancy holds ADR steady. The calculation assumes a full 365-day year, before operating costs. Seasonal charts follow your annual estimate; historical market occupancy stays unchanged.</p>
              {band && band.source !== "fallback" ? <p>Market revenue reference: {formatCurrency(band.min)}–{formatCurrency(band.max)} per year (25th–90th percentiles). This is context, not a limit on your assumptions.</p> : null}
              <p>Choosing comparables changes the evidence featured in your report; it does not automatically change these assumptions.</p>
            </div>
          </details>
        </div>
      </div>
      {enrichment?.market_occupancy ? (
        <details className="rounded-xl border border-base-300 bg-base-100 p-5 text-sm">
          <summary className="cursor-pointer font-medium">Monthly occupancy evidence · {enrichment.market_occupancy.status === "available" ? enrichment.market_occupancy.label : "unavailable"}</summary>
          <p className="mt-3">The report pairs a modelled monthly revenue estimate with historical occupancy for matching bedrooms and property type in the named market. This benchmark covers a broader area than the nearby report comparables.</p>
          {enrichment.market_occupancy.status === "available" && <p className="mt-2">{enrichment.market_occupancy.months.length} completed months, {enrichment.market_occupancy.months[0]?.month} to {enrichment.market_occupancy.months.at(-1)?.month}. Monthly median occupancy and the 25th–75th percentile range are shown.</p>}
          <ul className="mt-2 list-disc space-y-1 pl-5">{enrichment.market_occupancy.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
        </details>
      ) : null}
      <section className="space-y-4" aria-label="Comparable evidence">
        <div>
          <h3 className="text-lg font-semibold">
            Comparable short-term rentals
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {comps.length} nearby properties available for review.{" "}
            {enrichment?.radius_m
              ? `Search area: ${(enrichment.radius_m / 1000).toLocaleString("en-AU", { maximumFractionDigits: 1 })} km.`
              : ""}{" "}
            Choose up to six to feature, in selection order. Choosing report comparables keeps your estimate unchanged.
          </p>
        </div>
        {comps.length > 0 && <ComparableFilters query={query} onQueryChange={setQuery} selectedOnly={selectedOnly} onSelectedOnlyChange={setSelectedOnly} totalCount={comps.length} selectedCount={selectedIds.length} visibleCount={shownComps.length} />}
        {comps.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {shownComps.map((comp) => (
              <article
                key={comp.listing_id}
                className="du-card du-card-border min-w-0 overflow-hidden bg-base-100"
              >
                {comp.thumbnail_url ? (
                  <figure className="aspect-[16/9] bg-base-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={comp.thumbnail_url}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  </figure>
                ) : null}
                <div className="du-card-body gap-2 p-4">
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-medium">
                    <input type="checkbox" className="du-checkbox du-checkbox-sm" checked={selectedIds.includes(comp.listing_id)} disabled={busy} onChange={() => toggleComp(comp.listing_id)} aria-label={`Feature ${comp.name}`} />
                    {selectedIds.includes(comp.listing_id) ? `Selected · ${selectedIds.indexOf(comp.listing_id) + 1}` : "Feature in report"}
                  </label>
                  <h4 className="du-card-title text-base break-words">
                    {comp.name || "Comparable property"}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    {comp.bedrooms ?? "—"} bed · {comp.bathrooms ?? "—"} bath ·{" "}
                    {comp.accommodates ?? "—"} guests
                    {comp.distance_m != null
                      ? ` · ${(comp.distance_m / 1000).toFixed(1)} km away`
                      : ""}
                  </p>
                  {comp.property_type && <p className="text-xs text-muted-foreground">{comp.property_type}{comp.suburb ? ` · ${comp.suburb}` : ""}</p>}
                  {comp.match_notes?.length ? <p className="text-xs text-amber-700">{comp.match_notes.join(" · ")}</p> : null}
                  <p className="mt-1 text-lg font-semibold">
                    {formatCurrency(comp.annual_revenue)}
                    <span className="ml-1 text-xs font-normal text-muted-foreground">
                      est. gross / year
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatPercent(comp.occupancy_rate)} occupancy ·{" "}
                    {formatCurrency(comp.nightly_rate)} / night
                  </p>
                  {comp.reviews != null && <p className="text-xs text-muted-foreground">{comp.reviews} reviews{comp.rating != null ? ` · ${comp.rating.toFixed(1)} / 5` : ""}</p>}
                  {(comp.reserved_nights != null || comp.blocked_nights != null) && <p className="text-xs text-muted-foreground">{comp.reserved_nights ?? "—"} nights booked · {comp.blocked_nights ?? "—"} blocked in the last year</p>}
                  {comp.amenities?.length || comp.recent_occupancy_rate != null ? <details className="mt-1 text-xs text-muted-foreground">
                    <summary className="cursor-pointer font-medium">More property evidence</summary>
                    <div className="mt-2 space-y-2">
                      {comp.recent_occupancy_rate != null && <p>Last 90 days: {formatPercent(comp.recent_occupancy_rate)} occupancy{comp.recent_revenue != null ? ` · ${formatCurrency(comp.recent_revenue)} estimated gross revenue` : ""}. This is a shorter, seasonally different period.</p>}
                      {(comp.minimum_nights != null || comp.average_length_of_stay != null) && <p>Minimum stay: {comp.minimum_nights ?? "—"} nights · Average stay: {comp.average_length_of_stay?.toFixed(1) ?? "—"} nights</p>}
                      {(comp.superhost || comp.professional_management || comp.guest_favorite) && <p>{[comp.superhost && "Superhost", comp.professional_management && "Professionally managed", comp.guest_favorite && "Guest favourite"].filter(Boolean).join(" · ")}</p>}
                      {!!comp.amenities?.length && <p>Amenities: {comp.amenities.map((amenity) => amenity.replaceAll("_", " ")).join(", ")}</p>}
                    </div>
                  </details> : null}
                  {/^https?:\/\//i.test(comp.listing_url) ? (
                    <a
                      className="du-btn du-btn-sm du-btn-ghost mt-2 min-h-11 self-start"
                      href={comp.listing_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View property
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="du-alert text-sm">
            Individual comparable listings are unavailable. Review the estimate
            carefully before using it in a report.
          </p>
        )}
        {comps.length > 0 && shownComps.length === 0 ? <p className="text-sm text-muted-foreground">No comparables match this view.</p> : null}
      </section>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {DEFAULT_DISCLAIMER}
      </p>
    </section>
  );
});

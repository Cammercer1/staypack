"use client";

import { forwardRef, useImperativeHandle, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { DocumentStepHeader } from "@/components/documents/DocumentStepHeader";
import {
  applyStrEstimateAdjustments,
  resolveStrRevenueBand,
} from "@/lib/reports/strEstimateAdjustments";
import { formatCurrency, formatPercent } from "@/lib/reports/formatters";
import { jsonRequest, reportRequest } from "@/lib/reports/reportRequests";
import { DEFAULT_DISCLAIMER, type Listing, type Report } from "@/lib/types";

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
    onRefresh: () => void;
  }
>(function StrEstimateStep(
  { listing, report, busy, onComplete, onContinue, onBack, onRefresh },
  ref,
) {
  const estimate = report.final_estimate_json;
  const enrichment = report.str_enrichment_json;
  const [annual, setAnnual] = useState(String(estimate?.annualRevenue ?? ""));
  const [occupancy, setOccupancy] = useState(
    String(estimate?.occupancyRate ?? ""),
  );
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const band = useMemo(
    () => resolveStrRevenueBand(enrichment, estimate),
    [enrichment, estimate],
  );
  const valid =
    annual.trim() !== "" &&
    Number.isFinite(Number(annual)) &&
    Number(annual) > 0 &&
    Number(occupancy) >= 1 &&
    Number(occupancy) <= 100;
  const dirty =
    estimate?.annualRevenue !== Number(annual) ||
    estimate?.occupancyRate !== Number(occupancy);
  const adjusted =
    estimate && valid && dirty
      ? applyStrEstimateAdjustments(estimate, {
          annualRevenue: Number(annual),
          occupancyRate: Number(occupancy),
        })
      : estimate;
  useImperativeHandle(ref, () => ({
    savePendingEdits: async () => {
      setError(null);
      if (!adjusted || !valid) {
        setError(
          "Enter positive estimated annual revenue and occupancy between 1% and 100%.",
        );
        return null;
      }
      if (!dirty) return report;
      try {
        const payload = await reportRequest<{ report: Report }>(
          `/api/reports/${report.id}`,
          jsonRequest(
            {
              final_estimate_json: adjusted,
              user_overrides_json: {
                ...report.user_overrides_json,
                annualRevenue: adjusted.annualRevenue,
                occupancyRate: adjusted.occupancyRate,
                recommendedAnnualRevenue:
                  report.user_overrides_json?.recommendedAnnualRevenue ??
                  enrichment?.positioning?.annual_revenue ??
                  estimate?.annualRevenue,
                recommendedOccupancyRate:
                  report.user_overrides_json?.recommendedOccupancyRate ??
                  estimate?.occupancyRate,
                revenueBand: band,
              },
            },
            "PATCH",
          ),
        );
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
  const comps = enrichment?.comps ?? [];
  const shownComps = showAll ? comps : comps.slice(0, 6);
  return (
    <section data-theme="staypack-workspace" className="space-y-5">
      <DocumentStepHeader
        title="Review the estimate & evidence"
        description="Check the market evidence and figures before writing your report."
        status={
          <span className="du-badge du-badge-sm">
            {dirty ? "Unsaved figures" : "Saved figures"}
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
          disabled={busy || !valid}
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
            {report.airbtics_fetched_at ? (
              <p>
                Updated{" "}
                {new Date(report.airbtics_fetched_at).toLocaleDateString(
                  "en-AU",
                )}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="du-btn du-btn-sm du-btn-ghost min-h-11 self-start"
            disabled={busy}
            onClick={onRefresh}
          >
            Refresh estimate (resets adjustments)
          </button>
          <div className="grid gap-6 sm:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="text-sm font-medium">Estimated gross STR revenue</p>
              <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
                {formatCurrency(adjusted.annualRevenue)}
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  / year
                </span>
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Before management fees, cleaning, furnishing and other operating
                costs.
              </p>
            </div>
            <dl className="grid grid-cols-2 gap-4">
              <div>
                <dt className="text-sm text-muted-foreground">
                  Estimated occupancy
                </dt>
                <dd className="mt-1 text-2xl font-semibold">
                  {formatPercent(adjusted.occupancyRate)}
                </dd>
                <p className="text-xs text-muted-foreground">
                  About {adjusted.bookedNights} nights / year
                </p>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">
                  Average nightly rate
                </dt>
                <dd className="mt-1 text-2xl font-semibold">
                  {formatCurrency(adjusted.nightlyRate)}
                </dd>
                <p className="text-xs text-muted-foreground">
                  Per booked night
                </p>
              </div>
            </dl>
          </div>
          {enrichment?.positioning ? (
            <div className="border-t border-base-300 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-medium">Why this estimate?</h3>
                <span className="du-badge du-badge-sm capitalize">
                  {enrichment.positioning.confidence} confidence
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {enrichment.positioning.rationale}
              </p>
            </div>
          ) : null}
        </div>
      </div>
      <details className="rounded-xl border border-base-300 bg-base-100 p-5">
        <summary className="cursor-pointer font-medium">
          Adjust the figures{dirty ? " · Unsaved changes" : " (optional)"}
        </summary>
        <fieldset disabled={busy} className="mt-5 min-w-0 space-y-5">
          <p className="text-sm text-muted-foreground">
            Changing annual revenue recalculates the nightly rate. Changing
            occupancy holds annual revenue steady and recalculates booked nights
            and the nightly rate. Your figures are saved when you continue or
            change steps.
          </p>
          {band ? (
            <p className="text-sm">
              {band.source === "airbtics"
                ? "Comparable revenue range"
                : "Indicative adjustment range"}
              : {formatCurrency(band.min)}–{formatCurrency(band.max)} per year.{" "}
              {band.source === "fallback"
                ? "This is a guide around the estimate, not a measured market range."
                : "Based on the 25th–90th percentiles."}
            </p>
          ) : null}
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="str-annual" className="text-sm font-medium">
                Estimated annual revenue ($)
              </label>
              <input
                id="str-annual"
                type="number"
                inputMode="numeric"
                min="1"
                className="du-input w-full"
                value={annual}
                onChange={(event) => setAnnual(event.target.value)}
              />
              {band ? (
                <input
                  type="range"
                  aria-label="Adjust estimated annual revenue"
                  min={band.min}
                  max={band.max}
                  step="250"
                  value={Math.min(
                    band.max,
                    Math.max(band.min, Number(annual) || band.min),
                  )}
                  onChange={(event) => setAnnual(event.target.value)}
                  className="h-6 w-full accent-primary"
                />
              ) : null}
            </div>
            <div className="space-y-2">
              <label htmlFor="str-occupancy" className="text-sm font-medium">
                Estimated occupancy (%)
              </label>
              <input
                id="str-occupancy"
                type="number"
                inputMode="decimal"
                min="1"
                max="100"
                className="du-input w-full"
                value={occupancy}
                onChange={(event) => setOccupancy(event.target.value)}
              />
              <input
                type="range"
                aria-label="Adjust estimated occupancy"
                min="1"
                max="100"
                value={Number(occupancy) || 1}
                onChange={(event) => setOccupancy(event.target.value)}
                className="h-6 w-full accent-primary"
              />
            </div>
          </div>
          {!valid ? (
            <p role="alert" className="text-sm text-destructive">
              Enter positive estimated annual revenue and occupancy between 1%
              and 100%.
            </p>
          ) : null}
          <button
            type="button"
            className="du-btn du-btn-sm du-btn-outline min-h-11"
            onClick={() => {
              setAnnual(
                String(
                  report.user_overrides_json?.recommendedAnnualRevenue ??
                    enrichment?.positioning?.annual_revenue ??
                    estimate?.annualRevenue ??
                    "",
                ),
              );
              setOccupancy(
                String(
                  report.user_overrides_json?.recommendedOccupancyRate ??
                    estimate?.occupancyRate ??
                    "",
                ),
              );
            }}
          >
            Reset to recommended figures
          </button>
        </fieldset>
      </details>
      <section className="space-y-4" aria-label="Comparable evidence">
        <div>
          <h3 className="text-lg font-semibold">
            Comparable short-term rentals
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {enrichment?.comp_count ?? comps.length} properties inform this
            estimate.{" "}
            {enrichment?.radius_m
              ? `Search area: ${(enrichment.radius_m / 1000).toLocaleString("en-AU", { maximumFractionDigits: 1 })} km.`
              : ""}{" "}
            Compare size, guest capacity and performance.
          </p>
        </div>
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
        {comps.length > 6 ? (
          <button
            type="button"
            className="du-btn du-btn-outline min-h-11"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll
              ? "Show fewer properties"
              : `Show all ${comps.length} properties`}
          </button>
        ) : null}
      </section>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {DEFAULT_DISCLAIMER}
      </p>
    </section>
  );
});

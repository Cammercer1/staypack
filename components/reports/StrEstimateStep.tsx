"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AsyncLoadingOverlay } from "@/components/ui/async-loading-overlay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateAccommodates, formatCurrency, formatPercent } from "@/lib/reports/formatters";
import {
  applyStrEstimateAdjustments,
  resolveStrRevenueBand,
  type StrRevenueBand,
} from "@/lib/reports/strEstimateAdjustments";
import type {
  Listing,
  Report,
  StrEstimate,
  StrEnrichmentJson,
  StrEstimatePositioning,
} from "@/lib/types";

type Props = {
  listing: Listing;
  report: Report;
  onComplete: (state: { listing: Listing; report: Report }) => void;
  onContinue?: () => void;
};

export function StrEstimateStep({ listing, report, onComplete, onContinue }: Props) {
  const [estimate, setEstimate] = useState<StrEstimate | null>(
    report.final_estimate_json,
  );
  const [enrichment, setEnrichment] = useState<StrEnrichmentJson | null>(
    report.str_enrichment_json ?? null,
  );
  const [positioning, setPositioning] = useState<StrEstimatePositioning | null>(
    report.str_enrichment_json?.positioning ?? null,
  );
  const [overrideAnnual, setOverrideAnnual] = useState(
    String(report.final_estimate_json?.annualRevenue ?? ""),
  );
  const [overrideOccupancy, setOverrideOccupancy] = useState(
    String(report.final_estimate_json?.occupancyRate ?? ""),
  );
  const [recommendedAnnualRevenue, setRecommendedAnnualRevenue] = useState<
    number | null
  >(
    report.user_overrides_json?.recommendedAnnualRevenue ??
      report.str_enrichment_json?.positioning?.annual_revenue ??
      report.final_estimate_json?.annualRevenue ??
      null,
  );
  const [recommendedOccupancyRate, setRecommendedOccupancyRate] = useState<
    number | null
  >(
    report.user_overrides_json?.recommendedOccupancyRate ??
      report.final_estimate_json?.occupancyRate ??
      null,
  );
  const defaultAccommodates = useMemo(
    () => calculateAccommodates(listing.bedrooms, listing.accommodates),
    [listing.bedrooms, listing.accommodates],
  );
  const [accommodates, setAccommodates] = useState(String(defaultAccommodates));
  const [estimating, setEstimating] = useState(false);
  const [saving, setSaving] = useState(false);
  const loading = estimating || saving;
  const revenueBand = useMemo(
    () => resolveStrRevenueBand(enrichment, estimate),
    [enrichment, estimate],
  );
  const annualSliderValue = clampToRange(
    Number(overrideAnnual || estimate?.annualRevenue || 0),
    revenueBand?.min ?? 0,
    revenueBand?.max ?? 0,
  );
  const occupancySliderValue = clampToRange(
    Number(overrideOccupancy || estimate?.occupancyRate || 70),
    1,
    100,
  );
  const revenueStep = revenueBand
    ? Math.max(250, Math.round((revenueBand.max - revenueBand.min) / 100 / 250) * 250)
    : 500;
  const isEstimateDirty =
    estimate != null &&
    !sameEstimateValues(estimate, report.final_estimate_json);

  async function runEstimate() {
    if (!listing.property_address?.trim()) {
      toast.error("Add a property address before running the STR estimate");
      return;
    }

    const resolvedAccommodates = calculateAccommodates(
      listing.bedrooms,
      accommodates === "" ? null : Number(accommodates),
    );

    setEstimating(true);
    const response = await fetch("/api/airbtics/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        report_id: report.id,
        address: listing.property_address,
        latitude: listing.latitude,
        longitude: listing.longitude,
        bedrooms: listing.bedrooms,
        bathrooms: listing.bathrooms,
        accommodates: resolvedAccommodates,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload.error ?? "Estimate failed");
      setEstimating(false);
      return;
    }

    const nextEstimate = payload.estimate as StrEstimate;
    const nextPositioning =
      (payload.positioning as StrEstimatePositioning | null) ?? null;

    setEstimate(nextEstimate);
    setEnrichment((payload.enrichment as StrEnrichmentJson | null) ?? null);
    setPositioning(nextPositioning);
    setOverrideAnnual(String(nextEstimate.annualRevenue ?? ""));
    setOverrideOccupancy(String(nextEstimate.occupancyRate ?? ""));
    setRecommendedAnnualRevenue(
      nextPositioning?.annual_revenue ?? nextEstimate.annualRevenue ?? null,
    );
    setRecommendedOccupancyRate(nextEstimate.occupancyRate ?? null);
    setAccommodates(String(payload.accommodates ?? resolvedAccommodates));
    onComplete({
      listing: (payload.listing as Listing) ?? listing,
      report: payload.report as Report,
    });
    toast.success("STR estimate generated");
    setEstimating(false);
  }

  function applyAnnualRevenue(value: number) {
    if (!estimate) {
      return;
    }

    const annualRevenue = revenueBand
      ? clampToRange(value, revenueBand.min, revenueBand.max)
      : value;
    const nextEstimate = applyStrEstimateAdjustments(estimate, {
      annualRevenue,
      occupancyRate: Number(overrideOccupancy || estimate.occupancyRate || 70),
    });
    setEstimate(nextEstimate);
    setOverrideAnnual(String(nextEstimate.annualRevenue ?? ""));
    setOverrideOccupancy(String(nextEstimate.occupancyRate ?? ""));
  }

  function applyOccupancyRate(value: number) {
    if (!estimate) {
      return;
    }

    const nextEstimate = applyStrEstimateAdjustments(estimate, {
      annualRevenue: Number(overrideAnnual || estimate.annualRevenue || 0),
      occupancyRate: value,
    });
    setEstimate(nextEstimate);
    setOverrideAnnual(String(nextEstimate.annualRevenue ?? ""));
    setOverrideOccupancy(String(nextEstimate.occupancyRate ?? ""));
  }

  async function saveOverride({ continueAfter = false } = {}) {
    if (!estimate) {
      toast.error("Run an STR estimate before saving adjustments");
      return;
    }

    const annualRevenue = Number(overrideAnnual);
    const occupancyRate = Number(overrideOccupancy);

    if (!Number.isFinite(annualRevenue) || annualRevenue <= 0) {
      toast.error("Enter a valid annual revenue");
      return;
    }

    if (!Number.isFinite(occupancyRate) || occupancyRate <= 0) {
      toast.error("Enter a valid occupancy rate");
      return;
    }

    const adjustedEstimate = applyStrEstimateAdjustments(estimate, {
      annualRevenue,
      occupancyRate,
    });

    setSaving(true);
    const response = await fetch(`/api/reports/${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_overrides_json: {
          annualRevenue: adjustedEstimate.annualRevenue,
          occupancyRate: adjustedEstimate.occupancyRate,
          recommendedAnnualRevenue,
          recommendedOccupancyRate,
          revenueBand: revenueBand
            ? {
                min: revenueBand.min,
                max: revenueBand.max,
                source: revenueBand.source,
              }
            : null,
        },
        final_estimate_json: adjustedEstimate,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload.error ?? "Failed to save override");
      setSaving(false);
      return;
    }

    const nextReport = payload.report as Report;
    setEstimate(adjustedEstimate);
    onComplete({ listing, report: nextReport });
    toast.success("Estimate saved");
    setSaving(false);
    if (continueAfter) {
      onContinue?.();
    }
  }

  function continueToCopy() {
    if (isEstimateDirty) {
      void saveOverride({ continueAfter: true });
      return;
    }

    onContinue?.();
  }

  const estimateLoadingMessage =
    "Pulling comparable listings and seasonality data. This can take up to 30 seconds.";

  return (
    <AsyncLoadingOverlay
      active={estimating}
      title="Running STR estimate"
      description={estimateLoadingMessage}
    >
    <div className="space-y-6">
      <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm">
        <p className="font-medium">Property location</p>
        <p className="mt-1 text-muted-foreground">
          {listing.property_address || "No address saved yet"}
          {listing.suburb ? `, ${listing.suburb}` : ""}
          {listing.state ? ` ${listing.state}` : ""}
          {listing.postcode ? ` ${listing.postcode}` : ""}
        </p>
        {listing.latitude != null && listing.longitude != null ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Geocoded coordinates: {listing.latitude.toFixed(5)},{" "}
            {listing.longitude.toFixed(5)}
          </p>
        ) : (
          <p className="mt-2 text-xs text-muted-foreground">
            Coordinates will be resolved from the address when you run the estimate.
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="estimateBedrooms">Bedrooms</Label>
          <Input id="estimateBedrooms" value={String(listing.bedrooms ?? "—")} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="estimateBathrooms">Bathrooms</Label>
          <Input id="estimateBathrooms" value={String(listing.bathrooms ?? "—")} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="estimateAccommodates">Accommodates</Label>
          <Input
            id="estimateAccommodates"
            value={accommodates}
            onChange={(event) => setAccommodates(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Defaults to 2× bedrooms ({defaultAccommodates}). Change if needed for
            the estimate.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={runEstimate} disabled={loading}>
          {estimating ? (
            <>
              <Loader2 className="animate-spin" />
              Estimating...
            </>
          ) : (
            "Run STR estimate"
          )}
        </Button>
        {report.airbtics_fetched_at ? (
          <p className="text-sm text-muted-foreground">
            Last STR estimate saved.
          </p>
        ) : null}
      </div>

      {estimate ? (
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="Annual revenue" value={formatCurrency(estimate.annualRevenue)} />
          <Metric label="Monthly revenue" value={formatCurrency(estimate.monthlyRevenue)} />
          <Metric label="Weekly revenue" value={formatCurrency(estimate.weeklyRevenue)} />
          <Metric label="Average nightly rate" value={formatCurrency(estimate.nightlyRate)} />
          <Metric label="Occupancy" value={formatPercent(estimate.occupancyRate)} />
          <Metric label="Booked nights" value={String(estimate.bookedNights ?? "—")} />
        </div>
      ) : null}

      {estimate && positioning ? (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">Comp-aware positioning applied</p>
            <Badge variant="secondary" className="capitalize">
              {positioning.confidence} confidence
            </Badge>
          </div>
          {positioning.median_annual_revenue != null &&
          positioning.median_annual_revenue !== estimate.annualRevenue ? (
            <p className="mt-2 text-muted-foreground">
              Market median {formatCurrency(positioning.median_annual_revenue)}{" "}
              adjusted to {formatCurrency(estimate.annualRevenue)} based on
              comparable evidence.
            </p>
          ) : null}
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {positioning.rationale}
          </p>
        </div>
      ) : null}

      {estimate ? (
        <div className="space-y-5 rounded-xl border border-border/70 bg-background p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium">STR figure adjustments</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {revenueBand?.source === "airbtics"
                  ? "Airbtics percentile band with StayPacks recommendation marked."
                  : "Estimate adjustment band with StayPacks recommendation marked."}
              </p>
            </div>
            {isEstimateDirty ? (
              <Badge variant="secondary">Unsaved changes</Badge>
            ) : (
              <Badge variant="outline">Saved figures</Badge>
            )}
          </div>

          {revenueBand ? (
            <div className="space-y-3">
              <SliderHeader
                label="Annual revenue"
                value={formatCurrency(estimate.annualRevenue)}
                recommendation={
                  recommendedAnnualRevenue != null
                    ? formatCurrency(recommendedAnnualRevenue)
                    : null
                }
              />
              <div className="relative pt-3">
                <RecommendationTick
                  value={recommendedAnnualRevenue}
                  min={revenueBand.min}
                  max={revenueBand.max}
                />
                <input
                  id="annualRevenueScale"
                  type="range"
                  min={revenueBand.min}
                  max={revenueBand.max}
                  step={revenueStep}
                  value={annualSliderValue}
                  onChange={(event) => applyAnnualRevenue(Number(event.target.value))}
                  disabled={loading}
                  className="h-2 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
              <ScaleLabels band={revenueBand} />
              <div className="grid gap-3 sm:max-w-xs">
                <Label htmlFor="overrideAnnual">Exact annual revenue</Label>
                <Input
                  id="overrideAnnual"
                  type="number"
                  inputMode="numeric"
                  min={revenueBand.min}
                  max={revenueBand.max}
                  step={revenueStep}
                  value={overrideAnnual}
                  onChange={(event) => {
                    const next = event.target.value;
                    setOverrideAnnual(next);
                    const parsed = Number(next);
                    if (next && Number.isFinite(parsed) && parsed > 0) {
                      applyAnnualRevenue(parsed);
                    }
                  }}
                  disabled={loading}
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <SliderHeader
              label="Occupancy"
              value={formatPercent(estimate.occupancyRate)}
              recommendation={
                recommendedOccupancyRate != null
                  ? formatPercent(recommendedOccupancyRate)
                  : null
              }
            />
            <div className="relative pt-3">
              <RecommendationTick
                value={recommendedOccupancyRate}
                min={1}
                max={100}
              />
              <input
                id="occupancyScale"
                type="range"
                min={1}
                max={100}
                step={1}
                value={occupancySliderValue}
                onChange={(event) => applyOccupancyRate(Number(event.target.value))}
                disabled={loading}
                className="h-2 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
            <div className="flex items-center justify-between text-xs tabular-nums text-muted-foreground">
              <span>1%</span>
              <span>100%</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => saveOverride()}
              disabled={loading || !overrideAnnual || !overrideOccupancy}
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving...
                </>
              ) : (
                "Save adjusted figures"
              )}
            </Button>
            {onContinue ? (
              <Button
                onClick={continueToCopy}
                disabled={loading || !overrideAnnual || !overrideOccupancy}
              >
                {saving ? (
                  <>
                    <Loader2 className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Continue to collateral"
                )}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
    </AsyncLoadingOverlay>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function SliderHeader({
  label,
  value,
  recommendation,
}: {
  label: string;
  value: string;
  recommendation: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <Label>{label}</Label>
        <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      </div>
      {recommendation ? (
        <Badge variant="secondary">Recommended {recommendation}</Badge>
      ) : null}
    </div>
  );
}

function ScaleLabels({ band }: { band: StrRevenueBand }) {
  const middle = band.p50 ?? (band.min + band.max) / 2;

  return (
    <div className="flex items-center justify-between text-xs tabular-nums text-muted-foreground">
      <span>{formatCurrency(band.min)}</span>
      <span>{formatCurrency(middle)}</span>
      <span>{formatCurrency(band.max)}</span>
    </div>
  );
}

function RecommendationTick({
  value,
  min,
  max,
}: {
  value: number | null;
  min: number;
  max: number;
}) {
  if (value == null || max <= min) {
    return null;
  }

  const left = scalePositionPercent(value, min, max);

  return (
    <span
      aria-hidden
      className="pointer-events-none absolute top-0 h-6 w-px bg-primary"
      style={{ left: `${left}%` }}
    >
      <span className="absolute -left-1 top-0 h-2 w-2 rounded-full bg-primary" />
    </span>
  );
}

function scalePositionPercent(value: number, min: number, max: number) {
  if (max <= min) {
    return 0;
  }

  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
}

function clampToRange(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return min;
  }

  if (max <= min) {
    return value;
  }

  return Math.min(max, Math.max(min, value));
}

function sameEstimateValues(
  left: StrEstimate | null,
  right: StrEstimate | null,
) {
  if (!left || !right) {
    return left === right;
  }

  return (
    left.annualRevenue === right.annualRevenue &&
    left.monthlyRevenue === right.monthlyRevenue &&
    left.weeklyRevenue === right.weeklyRevenue &&
    left.nightlyRate === right.nightlyRate &&
    left.occupancyRate === right.occupancyRate &&
    left.bookedNights === right.bookedNights
  );
}

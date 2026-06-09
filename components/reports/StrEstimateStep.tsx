"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AsyncLoadingOverlay } from "@/components/ui/async-loading-overlay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { calculateAccommodates, formatCurrency, formatPercent } from "@/lib/reports/formatters";
import type { AirbticsTier, Listing, Report, StrEstimate } from "@/lib/types";

type Props = {
  listing: Listing;
  report: Report;
  onComplete: (state: { listing: Listing; report: Report }) => void;
};

type TierOption = {
  id: AirbticsTier;
  title: string;
  description: string;
  features: string[];
};

const TIER_OPTIONS: TierOption[] = [
  {
    id: "summary",
    title: "Summary estimate",
    description: "Headline STR numbers for the report.",
    features: [
      "Annual, monthly and weekly revenue",
      "Average nightly rate and occupancy",
      "Booked nights and search radius",
      "Fast result, lower data cost",
    ],
  },
  {
    id: "full",
    title: "Detailed estimate",
    description: "Same headline numbers plus market evidence for page 2.",
    features: [
      "Everything in the summary estimate",
      "Revenue range (25th to 90th percentile)",
      "Up to 40 comparable listings with photos",
      "Monthly seasonality for charts and copy",
      "More data for a stronger buyer report",
    ],
  },
];

export function StrEstimateStep({ listing, report, onComplete }: Props) {
  const [estimate, setEstimate] = useState<StrEstimate | null>(
    report.final_estimate_json,
  );
  const [selectedTier, setSelectedTier] = useState<AirbticsTier>(
    report.airbtics_tier ?? "summary",
  );
  const [overrideAnnual, setOverrideAnnual] = useState(
    String(report.final_estimate_json?.annualRevenue ?? ""),
  );
  const defaultAccommodates = useMemo(
    () => calculateAccommodates(listing.bedrooms, listing.accommodates),
    [listing.bedrooms, listing.accommodates],
  );
  const [accommodates, setAccommodates] = useState(String(defaultAccommodates));
  const [estimating, setEstimating] = useState(false);
  const [saving, setSaving] = useState(false);
  const loading = estimating || saving;

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
        tier: selectedTier,
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

    setEstimate(payload.estimate);
    setSelectedTier(payload.tier ?? selectedTier);
    setOverrideAnnual(String(payload.estimate.annualRevenue ?? ""));
    setAccommodates(String(payload.accommodates ?? resolvedAccommodates));
    onComplete({
      listing: (payload.listing as Listing) ?? listing,
      report: payload.report as Report,
    });
    toast.success(
      selectedTier === "full"
        ? "Detailed STR estimate generated"
        : "Light STR estimate generated",
    );
    setEstimating(false);
  }

  async function saveOverride() {
    setSaving(true);
    const response = await fetch(`/api/reports/${report.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_overrides_json: {
          annualRevenue: Number(overrideAnnual),
        },
        final_estimate_json: {
          ...(estimate ?? {}),
          annualRevenue: Number(overrideAnnual),
          monthlyRevenue: Math.round(Number(overrideAnnual) / 12),
          weeklyRevenue: Math.round(Number(overrideAnnual) / 52),
        },
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload.error ?? "Failed to save override");
      setSaving(false);
      return;
    }

    onComplete({ listing, report: payload.report as Report });
    toast.success("Estimate saved");
    setSaving(false);
  }

  const estimateLoadingMessage =
    selectedTier === "full"
      ? "Pulling comparable listings and seasonality data. This can take up to 30 seconds."
      : "Fetching headline revenue numbers. This usually takes 10–20 seconds.";

  return (
    <AsyncLoadingOverlay
      active={estimating}
      title={
        selectedTier === "full"
          ? "Running detailed STR estimate"
          : "Running light STR estimate"
      }
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

      <div className="space-y-3">
        <div>
          <Label>Estimate type</Label>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose how much market data to pull for this report.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {TIER_OPTIONS.map((option) => {
            const isSelected = selectedTier === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setSelectedTier(option.id)}
                disabled={loading}
                className={cn(
                  "rounded-xl border p-4 text-left transition-colors",
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border/70 bg-background hover:bg-muted/30",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{option.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                  {isSelected ? <Badge>Selected</Badge> : null}
                </div>

                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {option.features.map((feature) => (
                    <li key={feature} className="flex gap-2">
                      <span aria-hidden className="text-primary">
                        •
                      </span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={runEstimate} disabled={loading}>
          {estimating ? (
            <>
              <Loader2 className="animate-spin" />
              Estimating...
            </>
          ) : selectedTier === "full" ? (
            "Run detailed STR estimate"
          ) : (
            "Run summary STR estimate"
          )}
        </Button>
        {report.airbtics_tier ? (
          <p className="text-sm text-muted-foreground">
            Last run:{" "}
            {report.airbtics_tier === "full" ? "Detailed" : "Summary"} estimate
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

      <div className="space-y-2">
        <Label htmlFor="overrideAnnual">Manual annual override</Label>
        <Input
          id="overrideAnnual"
          value={overrideAnnual}
          onChange={(event) => setOverrideAnnual(event.target.value)}
        />
      </div>

      <Button variant="outline" onClick={saveOverride} disabled={loading || !overrideAnnual}>
        {saving ? (
          <>
            <Loader2 className="animate-spin" />
            Saving...
          </>
        ) : (
          "Save estimate override"
        )}
      </Button>
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

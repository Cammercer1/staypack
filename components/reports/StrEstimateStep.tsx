"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateAccommodates, formatCurrency, formatPercent } from "@/lib/reports/formatters";
import type { Report, StrEstimate } from "@/lib/types";

type Props = {
  report: Report;
  onComplete: (report: Report) => void;
};

export function StrEstimateStep({ report, onComplete }: Props) {
  const [estimate, setEstimate] = useState<StrEstimate | null>(
    report.final_estimate_json,
  );
  const [overrideAnnual, setOverrideAnnual] = useState(
    String(report.final_estimate_json?.annualRevenue ?? ""),
  );
  const defaultAccommodates = useMemo(
    () => calculateAccommodates(report.bedrooms, report.accommodates),
    [report.bedrooms, report.accommodates],
  );
  const [accommodates, setAccommodates] = useState(String(defaultAccommodates));
  const [loading, setLoading] = useState(false);

  async function runEstimate() {
    if (!report.property_address?.trim()) {
      toast.error("Add a property address before running the STR estimate");
      return;
    }

    const resolvedAccommodates = calculateAccommodates(
      report.bedrooms,
      accommodates === "" ? null : Number(accommodates),
    );

    setLoading(true);
    const response = await fetch("/api/airbtics/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        report_id: report.id,
        address: report.property_address,
        latitude: report.latitude,
        longitude: report.longitude,
        bedrooms: report.bedrooms,
        bathrooms: report.bathrooms,
        accommodates: resolvedAccommodates,
      }),
    });
    const payload = await response.json();

    if (!response.ok) {
      toast.error(payload.error ?? "Estimate failed");
      setLoading(false);
      return;
    }

    setEstimate(payload.estimate);
    setOverrideAnnual(String(payload.estimate.annualRevenue ?? ""));
    setAccommodates(String(payload.accommodates ?? resolvedAccommodates));
    onComplete(payload.report);
    toast.success("STR estimate generated");
    setLoading(false);
  }

  async function saveOverride() {
    setLoading(true);
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
      setLoading(false);
      return;
    }

    onComplete(payload.report);
    toast.success("Estimate saved");
    setLoading(false);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/70 bg-muted/20 p-4 text-sm">
        <p className="font-medium">Property location</p>
        <p className="mt-1 text-muted-foreground">
          {report.property_address || "No address saved yet"}
          {report.suburb ? `, ${report.suburb}` : ""}
          {report.state ? ` ${report.state}` : ""}
          {report.postcode ? ` ${report.postcode}` : ""}
        </p>
        {report.latitude != null && report.longitude != null ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Geocoded coordinates: {report.latitude.toFixed(5)},{" "}
            {report.longitude.toFixed(5)}
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
          <Input id="estimateBedrooms" value={String(report.bedrooms ?? "—")} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="estimateBathrooms">Bathrooms</Label>
          <Input id="estimateBathrooms" value={String(report.bathrooms ?? "—")} disabled />
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

      <Button onClick={runEstimate} disabled={loading}>
        {loading ? "Estimating..." : "Run STR estimate"}
      </Button>

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
        Save estimate override
      </Button>
    </div>
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

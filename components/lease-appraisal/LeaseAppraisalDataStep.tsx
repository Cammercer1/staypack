"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AsyncLoadingOverlay } from "@/components/ui/async-loading-overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  hasLeaseAppraisalComps,
} from "@/lib/lease-appraisal/generateLeaseAppraisalForListing";
import {
  MAX_LEASE_APPRAISAL_FEATURED_COMPS,
  defaultSelectedCompListingIds,
  orderLeaseAppraisalCompPool,
} from "@/lib/lease-appraisal/leaseAppraisalData";
import { rentalCompListingId } from "@/lib/lease-appraisal/rentalCompIds";
import { formatWeeklyRentRange } from "@/lib/rental/computeRentBand";
import {
  rentalCompSelectionTier,
} from "@/lib/rental/rankRentalCompsForSubject";
import { resolveRentalCompPropertyType } from "@/lib/rental/resolveRentalCompPropertyType";
import { resolveRentSubjectPropertyType } from "@/lib/rental/resolveRentSubjectPropertyType";
import { cn } from "@/lib/utils";
import type { LeaseAppraisalJob, Listing } from "@/lib/types";

const POLL_INTERVAL_MS = 10000;

type Props = {
  listing: Listing;
  activeJob?: LeaseAppraisalJob | null;
  compsPrefetching?: boolean;
  onListingChange: (listing: Listing) => void;
  onJobChange?: (job: LeaseAppraisalJob | null) => void;
  onContinue: () => void;
};

type ApiError = {
  error?: string;
};

export function LeaseAppraisalDataStep({
  listing,
  activeJob = null,
  compsPrefetching = false,
  onListingChange,
  onJobChange,
  onContinue,
}: Props) {
  const parsed = listing.scraped_listing_json;
  const pool = useMemo(
    () => (parsed ? orderLeaseAppraisalCompPool(parsed) : []),
    [parsed],
  );
  const appraisal = parsed?.rentalAppraisal;
  const subjectPropertyType = parsed
    ? resolveRentSubjectPropertyType(parsed)
    : listing.property_type ?? undefined;
  const jobProcessing =
    activeJob?.status === "pending" || activeJob?.status === "processing";
  const jobFailed = activeJob?.status === "failed";

  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const pollErrorShownRef = useRef(false);
  const jobCompletionToastRef = useRef<string | null>(null);
  const [weeklyMin, setWeeklyMin] = useState<string>(
    () => String(appraisal?.weeklyMin ?? ""),
  );
  const [weeklyMax, setWeeklyMax] = useState<string>(
    () => String(appraisal?.weeklyMax ?? ""),
  );
  const [weeklyMid, setWeeklyMid] = useState<string>(
    () => String(appraisal?.weeklyMidpoint ?? ""),
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (appraisal?.selectedCompListingIds?.length) {
      return appraisal.selectedCompListingIds;
    }
    if (parsed) {
      return defaultSelectedCompListingIds(parsed);
    }
    return [];
  });

  /* eslint-disable react-hooks/set-state-in-effect -- sync editable fields when job polling refreshes the listing. */
  useEffect(() => {
    setWeeklyMin(String(appraisal?.weeklyMin ?? ""));
    setWeeklyMax(String(appraisal?.weeklyMax ?? ""));
    setWeeklyMid(String(appraisal?.weeklyMidpoint ?? ""));
    if (appraisal?.selectedCompListingIds?.length) {
      setSelectedIds(appraisal.selectedCompListingIds);
    } else if (parsed && pool.length > 0) {
      setSelectedIds(defaultSelectedCompListingIds(parsed));
    }
  }, [listing.updated_at, appraisal, parsed, pool.length]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const compRows = useMemo(
    () =>
      pool.map((comp, index) => ({
        comp,
        id: rentalCompListingId(comp, index),
        tier: rentalCompSelectionTier(comp, subjectPropertyType),
      })),
    [pool, subjectPropertyType],
  );
  const exactCompRows = compRows.filter((row) => row.tier === "exact");
  const fallbackCompRows = compRows.filter(
    (row) => row.tier === "upper_band_unit_fallback",
  );
  const otherCompRows = compRows.filter((row) => row.tier === "other");
  const discovery = appraisal?.discovery;

  const rentSummary = useMemo(() => {
    const min = Number(weeklyMin);
    const max = Number(weeklyMax);
    if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max > 0) {
      return formatWeeklyRentRange(min, max);
    }
    const mid = Number(weeklyMid);
    if (Number.isFinite(mid) && mid > 0) {
      return formatWeeklyRentRange(mid, mid);
    }
    return null;
  }, [weeklyMin, weeklyMax, weeklyMid]);

  const compsReady = hasLeaseAppraisalComps(parsed);
  const initialCompsProcessing = jobProcessing && !compsReady;
  const refreshingComps = jobProcessing && compsReady;
  const canContinue = compsReady && selectedIds.length > 0;

  useEffect(() => {
    if (!jobProcessing || !activeJob?.id) {
      return;
    }

    const jobId = activeJob.id;
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    async function pollListing() {
      try {
        const response = await fetch(
          `/api/listings/${listing.id}/lease-appraisal/jobs/${jobId}`,
          { cache: "no-store" },
        );
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to refresh appraisal data");
        }

        const nextJob = payload.job as LeaseAppraisalJob | undefined;
        const nextListing = payload.listing as Listing | undefined;
        if (!cancelled && nextJob) {
          onJobChange?.(nextJob);
        }
        if (!cancelled && nextListing) {
          onListingChange(nextListing);
        }
        if (!cancelled && nextJob) {
          if (nextJob.status === "completed" || nextJob.status === "failed") {
            if (interval) {
              clearInterval(interval);
            }
            if (jobCompletionToastRef.current !== nextJob.id) {
              jobCompletionToastRef.current = nextJob.id;
              if (nextJob.status === "completed") {
                toast.success("Rental comps updated");
              } else {
                toast.error(
                  nextJob.error_message ??
                    "Rental comps failed to update. Refresh comps to try again.",
                );
              }
            }
          }
        }
      } catch (error) {
        if (!cancelled && !pollErrorShownRef.current) {
          pollErrorShownRef.current = true;
          toast.error(
            error instanceof Error
              ? error.message
              : "Unable to refresh appraisal data",
          );
        }
      }
    }

    void pollListing();
    interval = setInterval(() => {
      void pollListing();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [
    activeJob?.id,
    listing.id,
    jobProcessing,
    onJobChange,
    onListingChange,
  ]);

  function toggleComp(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }
      if (current.length >= MAX_LEASE_APPRAISAL_FEATURED_COMPS) {
        toast.error(`Select up to ${MAX_LEASE_APPRAISAL_FEATURED_COMPS} comparables`);
        return current;
      }
      return [...current, id];
    });
  }

  async function fetchComps(options?: { silent?: boolean }) {
    setFetching(true);
    try {
      const response = await fetch(`/api/listings/${listing.id}/lease-appraisal/enrich`, {
        method: "POST",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to fetch rental comps");
      }
      if (payload.listing) {
        onListingChange(payload.listing as Listing);
      }
      if (payload.job) {
        onJobChange?.(payload.job as LeaseAppraisalJob);
      }
      if (!options?.silent) {
        toast.success(
          response.status === 202
            ? "Rental comps are updating in the background"
            : "Rental comps updated",
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to fetch rental comps",
      );
    } finally {
      setFetching(false);
    }
  }

  async function saveAndContinue() {
    if (!canContinue) {
      toast.error("Fetch comps and select at least one comparable");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `/api/listings/${listing.id}/lease-appraisal/data`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            weekly_min: parseRent(weeklyMin),
            weekly_max: parseRent(weeklyMax),
            weekly_midpoint: parseRent(weeklyMid),
            selected_comp_listing_ids: selectedIds,
          }),
        },
      );
      const payload = (await response.json()) as ApiError & { listing?: Listing };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save appraisal data");
      }
      if (payload.listing) {
        onListingChange(payload.listing);
      }
      toast.success("Appraisal data saved");
      onContinue();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save appraisal data",
      );
    } finally {
      setSaving(false);
    }
  }

  const loading = fetching || saving || compsPrefetching || initialCompsProcessing;
  const fetchingComps = compsPrefetching || fetching || initialCompsProcessing;

  return (
    <AsyncLoadingOverlay
      active={loading}
      title={fetchingComps ? "Fetching rental comps" : "Saving appraisal data"}
      description={
        fetchingComps
          ? "Searching comparable rentals and suburb context. This can take 1–3 minutes."
          : "Saving your rent band and comparable selection."
      }
      className="space-y-8"
    >
      <div>
        <h2 className="text-lg font-semibold">Appraisal data</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {compsReady
            ? refreshingComps
              ? "Comparable rentals are refreshing in the background. Current comps remain available while the appraisal updates."
              : `Comps are sorted with ${listing.suburb ?? "your suburb"} first, then nearby areas. Review the rent band, pick up to ${MAX_LEASE_APPRAISAL_FEATURED_COMPS} for page 2, and use Refresh to re-fetch from REA.`
            : jobProcessing
              ? "Comparable rentals are being fetched in the background. This page will update when they are ready."
              : "Comparable rentals load when you start the appraisal. Adjust the weekly rent band if needed, then choose featured comps."}
        </p>
      </div>

      <div className="surface-card space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-medium">Comparable rentals</p>
          {refreshingComps ? (
            <Badge variant="secondary">Refreshing</Badge>
          ) : compsReady ? (
            <Badge variant="secondary">Ready</Badge>
          ) : jobProcessing ? (
            <Badge variant="secondary">Fetching</Badge>
          ) : jobFailed ? (
            <Badge variant="destructive">Failed</Badge>
          ) : (
            <Badge variant="outline">Required</Badge>
          )}
        </div>

        <Button
          variant="outline"
          onClick={() => void fetchComps()}
          disabled={loading || refreshingComps}
        >
          {compsPrefetching || fetching || jobProcessing ? (
            <>
              <Loader2 className="animate-spin" />
              Fetching comps...
            </>
          ) : compsReady ? (
            "Refresh comps"
          ) : (
            "Fetch rental comps"
          )}
        </Button>
        {refreshingComps ? (
          <p className="text-sm text-muted-foreground">
            The current comps are shown below. The refresh will replace them when
            it finishes.
          </p>
        ) : jobProcessing ? (
          <p className="text-sm text-muted-foreground">
            REA comps can take 1–3 minutes. You can keep this tab open while the
            appraisal updates.
          </p>
        ) : jobFailed ? (
          <p className="text-sm text-destructive">
            {activeJob?.error_message ??
              "Rental comps failed to update. Refresh comps to try again."}
          </p>
        ) : null}
      </div>

      {compsReady ? (
        <>
          <div className="surface-card grid gap-4 p-6 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="weekly-min">Weekly min ($)</Label>
              <Input
                id="weekly-min"
                type="number"
                min={0}
                value={weeklyMin}
                onChange={(e) => setWeeklyMin(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weekly-max">Weekly max ($)</Label>
              <Input
                id="weekly-max"
                type="number"
                min={0}
                value={weeklyMax}
                onChange={(e) => setWeeklyMax(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weekly-mid">Weekly midpoint ($)</Label>
              <Input
                id="weekly-mid"
                type="number"
                min={0}
                value={weeklyMid}
                onChange={(e) => setWeeklyMid(e.target.value)}
              />
            </div>
            {rentSummary ? (
              <p className="text-sm text-muted-foreground sm:col-span-3">
                Guide range: <span className="font-medium text-foreground">{rentSummary}</span>
              </p>
            ) : null}
          </div>

          <div className="surface-card space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">Featured comparables</p>
              <div className="text-right text-sm text-muted-foreground">
                <p>{compRows.length} candidates found</p>
                <p>
                  {selectedIds.length} / {MAX_LEASE_APPRAISAL_FEATURED_COMPS} selected for the report
                </p>
              </div>
            </div>

            {discovery && !discovery.targetMet ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
                <p className="font-medium">Comparable evidence is below target</p>
                <p className="mt-1 text-amber-900/80">
                  Found {discovery.poolCount}/{discovery.targetCount} candidates,
                  including {discovery.sameSuburbCount}/
                  {discovery.targetSameSuburbCount} in {listing.suburb ?? "the subject suburb"}.
                  Review the candidates carefully or refresh before using the guide
                  range.
                </p>
              </div>
            ) : null}

            {fallbackCompRows.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
                <p className="font-medium">
                  {exactCompRows.length} exact {formatPropertyType(subjectPropertyType).toLowerCase()} {exactCompRows.length === 1 ? "match" : "matches"}
                </p>
                <p className="mt-1 text-amber-900/80">
                  The rent estimate uses the exact matches. Upper-band units are
                  available below only to fill the report&apos;s comparable grid and
                  are clearly marked as secondary evidence.
                </p>
              </div>
            ) : null}

            {compRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No comparables returned — try refreshing comps.
              </p>
            ) : (
              <div className="space-y-6">
                {[
                  {
                    key: "exact",
                    title: "Best property-type matches",
                    description: "These comparables drive the suggested rent range.",
                    rows: exactCompRows,
                  },
                  {
                    key: "fallback",
                    title: "Upper-band unit alternatives",
                    description:
                      "Secondary options matched on bedrooms and rent level; they do not change the townhouse estimate.",
                    rows: fallbackCompRows,
                  },
                  {
                    key: "other",
                    title: "Nearby alternatives",
                    description:
                      "Broader options are shown only when exact property-type evidence is limited.",
                    rows: otherCompRows,
                  },
                ].map((group) =>
                  group.rows.length > 0 ? (
                    <section key={group.key} className="space-y-3">
                      <div>
                        <p className="text-sm font-medium">{group.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {group.description}
                        </p>
                      </div>
                      <ul className="grid gap-3 sm:grid-cols-2">
                        {group.rows.map(({ comp, id, tier }) => {
                          const selected = selectedIds.includes(id);
                          const propertyType = formatPropertyType(
                            resolveRentalCompPropertyType(comp),
                          );
                          return (
                            <li key={id}>
                              <button
                                type="button"
                                aria-pressed={selected}
                                onClick={() => toggleComp(id)}
                                className={cn(
                                  "flex w-full gap-3 rounded-xl border p-3 text-left transition-colors",
                                  selected
                                    ? "border-primary bg-primary/5 shadow-sm"
                                    : "border-border hover:border-primary/40",
                                )}
                              >
                                <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-muted">
                                  {comp.imageUrl ? (
                                    <Image
                                      src={comp.imageUrl}
                                      alt=""
                                      fill
                                      className="object-cover"
                                      sizes="112px"
                                      unoptimized
                                    />
                                  ) : null}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <Badge variant="secondary" className="text-[10px]">
                                      {propertyType}
                                    </Badge>
                                    {tier !== "exact" ? (
                                      <Badge
                                        variant="outline"
                                        className="border-amber-300 bg-amber-50 text-[10px] text-amber-900"
                                      >
                                        {tier === "upper_band_unit_fallback"
                                          ? "Secondary fallback"
                                          : "Nearby fallback"}
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[10px]">
                                        Exact type
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-sm font-medium">
                                    {comp.address}
                                  </p>
                                  <p className="mt-1 text-sm font-semibold">
                                    ${comp.weeklyRent}/wk
                                  </p>
                                  <p className="mt-0.5 text-xs text-muted-foreground">
                                    {comp.bedrooms ?? "?"} bed · {comp.bathrooms ?? "?"} bath · {comp.carSpaces ?? "?"} car
                                    {comp.suburb ? ` · ${comp.suburb}` : ""}
                                  </p>
                                </div>
                                {selected ? (
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                    <Check className="h-4 w-4" />
                                  </span>
                                ) : null}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  ) : null,
                )}
              </div>
            )}
          </div>
        </>
      ) : null}

      <Button onClick={saveAndContinue} disabled={loading || !canContinue}>
        {saving ? (
          <>
            <Loader2 className="animate-spin" />
            Saving...
          </>
        ) : (
          "Continue to content generation"
        )}
      </Button>
    </AsyncLoadingOverlay>
  );
}

function parseRent(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function formatPropertyType(value?: string) {
  const normalized = value?.trim() || "Property";
  return normalized
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

"use client";
import { UnsavedListingGuard } from "@/components/listings/UnsavedListingGuard";
import { AppraisalDataToolbar } from "@/components/appraisals/AppraisalDataToolbar";
import { ComparableFilters } from "@/components/appraisals/ComparableFilters";
import { UsComparableDetails, UsComparableSearchSummary } from "@/components/appraisals/UsComparableDetails";
import { avmPriceSuggestion } from "@/lib/listings/pricing";

import { resolveAppraisalInput, appraisalInputError, hasStaleAppraisal } from "@/lib/appraisals/resolveAppraisalInput";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Check, House, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  hasLeaseAppraisalComps,
} from "@/lib/lease-appraisal/generateLeaseAppraisalForListing";
import {
  MAX_LEASE_APPRAISAL_FEATURED_COMPS,
  defaultSelectedCompListingIds,
  orderLeaseAppraisalCompPool,
} from "@/lib/lease-appraisal/leaseAppraisalData";
import { rentalCompListingId } from "@/lib/lease-appraisal/rentalCompIds";
import { marketForCountry, rentForPeriod, rentFromPeriod, rentRange } from "@/lib/property-market";
import {
  rentalCompSelectionTier,
} from "@/lib/rental/rankRentalCompsForSubject";
import { resolveRentalCompPropertyType } from "@/lib/rental/resolveRentalCompPropertyType";
import { resolveRentSubjectPropertyType } from "@/lib/rental/resolveRentSubjectPropertyType";
import { cn } from "@/lib/utils";
import type { LeaseAppraisalJob, Listing } from "@/lib/types";

const POLL_INTERVAL_MS = 2000;

type Props = {
  appraisalEndpoint?: string;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  listing: Listing;
  activeJob?: LeaseAppraisalJob | null;
  compsPrefetching?: boolean;
  onListingChange: (listing: Listing) => void;
  onJobChange?: (job: LeaseAppraisalJob | null) => void;
  onContinue: (listing?: Listing) => void;
  continueLabel?: string;
};

type ApiError = {
  error?: string;
};

export function LeaseAppraisalDataStep({
  appraisalEndpoint,
  onDirtyChange,
  listing,
  activeJob = null,
  compsPrefetching = false,
  onListingChange,
  onJobChange,
  onContinue,
  continueLabel,
  onBusyChange,
}: Props) {
  const endpoint = appraisalEndpoint ?? `/api/listings/${listing.id}/lease-appraisal`;
  const market = useMemo(() => marketForCountry(listing.country), [listing.country]);
  const localRent = useCallback((value?: number) => value == null ? "" : String(Number(rentForPeriod(value, market).toFixed(6))), [market]);
  const parsed = useMemo(() => resolveAppraisalInput(listing), [listing]);
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

  const priceEdited = useRef(false);
  const selectionEdited = useRef(false);
  const estimate = avmPriceSuggestion(listing, "lease");
  const hasPriceOverride = Boolean(listing.appraisal_overrides_json?.lease);
  const [query, setQuery] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const pollErrorShownRef = useRef(false);
  const jobCompletionToastRef = useRef<string | null>(null);
  const [weeklyMin, setWeeklyMin] = useState<string>(
    () => localRent(appraisal?.weeklyMin),
  );
  const [weeklyMax, setWeeklyMax] = useState<string>(
    () => localRent(appraisal?.weeklyMax),
  );
  const [weeklyMid, setWeeklyMid] = useState<string>(
    () => localRent(appraisal?.weeklyMidpoint),
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

  const evidenceDirty = weeklyMin !== localRent(appraisal?.weeklyMin) || weeklyMax !== localRent(appraisal?.weeklyMax) || weeklyMid !== localRent(appraisal?.weeklyMidpoint)
    || JSON.stringify(selectedIds) !== JSON.stringify(appraisal?.selectedCompListingIds?.length ? appraisal.selectedCompListingIds : defaultSelectedCompListingIds(parsed));
  useEffect(() => { onDirtyChange?.(evidenceDirty); }, [evidenceDirty, onDirtyChange]);

  /* eslint-disable react-hooks/set-state-in-effect -- sync editable fields when job polling refreshes the listing. */
  useEffect(() => {
    if (!priceEdited.current) {
      setWeeklyMin(localRent(appraisal?.weeklyMin));
      setWeeklyMax(localRent(appraisal?.weeklyMax));
      setWeeklyMid(localRent(appraisal?.weeklyMidpoint));
    }
    if (selectionEdited.current) {
      const availableIds = new Set(pool.map(rentalCompListingId));
      setSelectedIds(current => current.filter(id => availableIds.has(id)));
    } else if (appraisal?.selectedCompListingIds?.length) {
      setSelectedIds(appraisal.selectedCompListingIds);
    } else if (parsed && pool.length > 0) {
      setSelectedIds(defaultSelectedCompListingIds(parsed));
    }
  }, [listing.updated_at, appraisal, parsed, pool, localRent]);
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
  const visibleCompRows = compRows.filter(({ comp, id }) =>
    (!selectedOnly || selectedIds.includes(id)) &&
    `${comp.address} ${comp.suburb ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const exactCompRows = visibleCompRows.filter((row) => row.tier === "exact");
  const fallbackCompRows = visibleCompRows.filter(
    (row) => row.tier === "upper_band_unit_fallback",
  );
  const otherCompRows = visibleCompRows.filter((row) => row.tier === "other");
  const discovery = appraisal?.discovery;

  const rentSummary = useMemo(() => {
    const min = Number(weeklyMin);
    const max = Number(weeklyMax);
    if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max > 0) {
      return rentRange(rentFromPeriod(min, market), rentFromPeriod(max, market), market);
    }
    const mid = Number(weeklyMid);
    if (Number.isFinite(mid) && mid > 0) {
      return rentRange(rentFromPeriod(mid, market), rentFromPeriod(mid, market), market);
    }
    return null;
  }, [weeklyMin, weeklyMax, weeklyMid, market]);

  const inputError = appraisalInputError(listing);
  const staleEvidence = hasStaleAppraisal(listing, "lease");
  const compsReady = hasLeaseAppraisalComps(parsed);
  const noCompsFound = activeJob?.status === "completed" && !compsReady && !staleEvidence && !inputError;
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
          `${endpoint}/jobs/${jobId}`,
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
                if (nextListing && hasLeaseAppraisalComps(resolveAppraisalInput(nextListing))) {
                  toast.success("Rental comps updated");
                } else {
                  toast.info("Search completed without suitable comparables");
                }
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
    endpoint,
    jobProcessing,
    onJobChange,
    onListingChange,
  ]);

  function toggleComp(id: string) {
    if (selectedIds.includes(id)) {
      selectionEdited.current = true;
      setSelectedIds(selectedIds.filter(item => item !== id));
    } else if (selectedIds.length >= MAX_LEASE_APPRAISAL_FEATURED_COMPS) {
      toast.error(`Select up to ${MAX_LEASE_APPRAISAL_FEATURED_COMPS} comparables`);
    } else {
      selectionEdited.current = true;
      setSelectedIds([...selectedIds, id]);
    }
  }

  async function fetchComps(options?: { silent?: boolean }) {
    setFetching(true);
    try {
      const response = await fetch(`${endpoint}/enrich`, {
        method: "POST",
        ...(appraisalEndpoint ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expected_updated_at: listing.updated_at }) } : {}),
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

  async function resetPrice() {
    setSaving(true);
    try {
      const response = await fetch(`${endpoint}/data`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reset_price: true, ...(appraisalEndpoint ? { expected_updated_at: listing.updated_at } : {}) }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to reset appraisal");
      priceEdited.current = false;
      onListingChange(payload.listing);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reset appraisal");
    } finally { setSaving(false); }
  }

  useEffect(() => {
    onBusyChange?.(saving || (Boolean(appraisalEndpoint) && fetching));
    return () => onBusyChange?.(false);
  }, [saving, fetching, appraisalEndpoint, onBusyChange]);

  async function saveAndContinue() {
    if (!canContinue) {
      toast.error("Fetch comps and select at least one comparable");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `${endpoint}/data`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(appraisalEndpoint ? { expected_updated_at: listing.updated_at } : {}),
            ...(priceEdited.current ? {
              weekly_min: (weeklyMin.trim() ? rentFromPeriod(Number(weeklyMin), market) : null),
              weekly_max: (weeklyMax.trim() ? rentFromPeriod(Number(weeklyMax), market) : null),
              weekly_midpoint: (weeklyMid.trim() ? rentFromPeriod(Number(weeklyMid), market) : null),
            } : {}),
            selected_comp_listing_ids: selectedIds,
          }),
        },
      );
      const payload = (await response.json()) as ApiError & { listing?: Listing };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save appraisal data");
      }
      selectionEdited.current = false;
      if (payload.listing) {
        onListingChange(payload.listing);
      }
      priceEdited.current = false;
      toast.success("Appraisal data saved");
      onContinue(payload.listing);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save appraisal data",
      );
    } finally {
      setSaving(false);
    }
  }

  const loading = fetching || saving;
  const fetchingComps = compsPrefetching || fetching || initialCompsProcessing;

  return (
    <div data-theme="staypack-workspace" className="space-y-5 text-base-content">
      {appraisalEndpoint && <UnsavedListingGuard dirty={evidenceDirty} description="Your evidence changes are unsaved. Continue to proposal to save them." />}
      <AppraisalDataToolbar
        summary={rentSummary}
        selectedCount={selectedIds.length}
        maxSelected={MAX_LEASE_APPRAISAL_FEATURED_COMPS}
        saving={saving}
        disabled={loading || !canContinue}
        guidance={inputError ?? (fetchingComps && !compsReady
          ? "Finding comparables. You can review the figures while we search."
          : !compsReady ? "Fetch comparable evidence below to continue."
          : selectedIds.length === 0 ? "Select at least one comparable below to continue."
          : "Review the figures and selected comparables, then continue.")}
        continueLabel={continueLabel}
        onContinue={saveAndContinue}
      />
      <fieldset disabled={saving || (Boolean(appraisalEndpoint) && jobProcessing)} className="min-w-0 space-y-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Review appraisal evidence</h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-base-content/65">
          {compsReady
            ? refreshingComps
              ? "Comparable rentals are refreshing in the background. Current comps remain available while the appraisal updates."
              : `Review the suggested rent range and choose up to ${MAX_LEASE_APPRAISAL_FEATURED_COMPS} comparable rentals. Properties in ${listing.suburb ?? "your suburb"} appear first, followed by nearby areas.`
            : jobProcessing
              ? "Comparable rentals are being fetched in the background. This page will update when they are ready."
              : `Fetch comparable rentals to support your appraisal. Adjust the ${market.rentPeriod === "month" ? "monthly" : "weekly"} rent band if needed, then choose featured comps.`}
        </p>
      </div>

      <div className="rounded-2xl border border-base-300 bg-base-100 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">Comparable rentals</p>
          {refreshingComps ? (
            <span className="du-badge du-badge-sm du-badge-ghost">Refreshing</span>
          ) : compsReady ? (
            <span className="du-badge du-badge-sm du-badge-success">Ready</span>
          ) : jobProcessing ? (
            <span className="du-badge du-badge-sm du-badge-ghost">Fetching</span>
          ) : jobFailed ? (
            <span className="du-badge du-badge-sm du-badge-error">Failed</span>
          ) : (
            <span className="du-badge du-badge-sm du-badge-outline">{noCompsFound ? "No matches" : "Required"}</span>
          )}
        </div>

        <button
          type="button"
          className="du-btn du-btn-sm min-h-11 w-full sm:w-auto"
          onClick={() => void fetchComps()}
          disabled={loading || compsPrefetching || jobProcessing || Boolean(inputError)}
        >
          {compsPrefetching || fetching || jobProcessing ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              Fetching comps...
            </>
          ) : compsReady ? (
            "Refresh comps"
          ) : (
            "Fetch rental comps"
          )}
        </button>
        </div>
        {refreshingComps ? (
          <p role="status" className="mt-3 text-sm leading-relaxed text-base-content/65">
            The current comps are shown below. The refresh will replace them when
            it finishes.
          </p>
        ) : jobProcessing ? (
          <p role="status" className="mt-3 text-sm leading-relaxed text-base-content/65">
            Your appraisal is updating. This may take a few minutes.
          </p>
        ) : jobFailed ? (
          <p role="alert" className="du-alert du-alert-error mt-3 text-left text-sm">
            {activeJob?.error_message ??
              "Rental comps failed to update. Refresh comps to try again."}
          </p>
        ) : noCompsFound ? (
          <p role="status" className="mt-3 text-sm leading-relaxed text-base-content/65">
            No suitable comparable rentals were found. Check the property details, then try fetching comparables again.
          </p>
        ) : null}
      </div>

      {inputError ? <p role="alert" className="du-alert du-alert-error text-left text-sm">{inputError}</p> : staleEvidence ? <p role="status" className="du-alert du-alert-warning text-left text-sm">Property details changed. Fetch comparables again to update the appraisal.</p> : null}

      <>
          <div className="grid gap-5 rounded-2xl border border-base-300 bg-base-100 p-5 sm:grid-cols-3 sm:p-6">
            <div className="space-y-2 text-sm sm:col-span-3">
              <h3 className="text-lg font-semibold">{hasPriceOverride ? "Your appraisal override" : "Suggested appraisal"}</h3>
              <p className="leading-relaxed text-base-content/65">Edit any amount below. Your saved figures are kept when comparables refresh.</p>
              {estimate && <p className="rounded-xl bg-base-200/60 px-3 py-2.5 text-xs leading-relaxed text-base-content/65">Automated estimate: {estimate.display}{estimate.date ? ` · ${estimate.date}` : ""}{estimate.confidence ? ` · ${estimate.confidence} confidence` : ""}. This may be outdated; use your local knowledge.</p>}
              {hasPriceOverride && <button type="button" className="du-btn du-btn-sm min-h-11 h-auto w-full py-2 text-wrap sm:w-auto" disabled={loading || refreshingComps} onClick={resetPrice}>Use latest suggested appraisal</button>}
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium" htmlFor="weekly-min">{market.rentPeriod === "month" ? "Monthly" : "Weekly"} min ({market.country === "US" ? "USD" : "$"})</label>
              <input
                className="du-input du-input-sm min-h-12 w-full min-w-0 text-base font-medium tabular-nums"
                inputMode="decimal"
                id="weekly-min"
                type="number"
                min={0}
                value={weeklyMin}
                onChange={(e) => { priceEdited.current = true; setWeeklyMin(e.target.value); }}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium" htmlFor="weekly-max">{market.rentPeriod === "month" ? "Monthly" : "Weekly"} max ({market.country === "US" ? "USD" : "$"})</label>
              <input
                className="du-input du-input-sm min-h-12 w-full min-w-0 text-base font-medium tabular-nums"
                inputMode="decimal"
                id="weekly-max"
                type="number"
                min={0}
                value={weeklyMax}
                onChange={(e) => { priceEdited.current = true; setWeeklyMax(e.target.value); }}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium" htmlFor="weekly-mid">{market.rentPeriod === "month" ? "Monthly" : "Weekly"} midpoint ({market.country === "US" ? "USD" : "$"})</label>
              <input
                className="du-input du-input-sm min-h-12 w-full min-w-0 text-base font-medium tabular-nums"
                inputMode="decimal"
                id="weekly-mid"
                type="number"
                min={0}
                value={weeklyMid}
                onChange={(e) => { priceEdited.current = true; setWeeklyMid(e.target.value); }}
              />
            </div>
            {rentSummary ? (
              <p className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-base-200/60 px-4 py-3 text-sm text-base-content/65 sm:col-span-3">
                Guide range: <span className="text-lg font-semibold tabular-nums text-base-content">{rentSummary}</span>
              </p>
            ) : null}
          </div>

          <div className="space-y-5 rounded-2xl border border-base-300 bg-base-100 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h3 className="text-lg font-semibold">Featured comparables</h3><p className="mt-1 text-sm text-base-content/65">Choose the evidence that best supports your appraisal.</p></div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-base-content/65 sm:justify-end">
                <p>{compRows.length} candidates found</p>
                <p className="du-badge du-badge-sm h-auto min-h-7 py-1">
                  {selectedIds.length} / {MAX_LEASE_APPRAISAL_FEATURED_COMPS} selected for the report
                </p>
              </div>
            </div>

            <UsComparableSearchSummary search={appraisal?.usSearch} />
            {discovery && !discovery.targetMet ? (
              <div role="status" className="du-alert du-alert-warning block text-left text-sm">
                <p className="font-medium">Comparable evidence is below target</p>
                <p className="mt-1 text-warning-content/80">
                  Found {discovery.poolCount}/{discovery.targetCount} candidates,
                  including {discovery.sameSuburbCount}/
                  {discovery.targetSameSuburbCount} in {listing.suburb ?? "the subject suburb"}.
                  Review the candidates carefully or refresh before using the guide
                  range.
                </p>
              </div>
            ) : null}

            {compRows.some((row) => row.tier === "upper_band_unit_fallback") ? (
              <div role="status" className="du-alert du-alert-warning block text-left text-sm">
                <p className="font-medium">
                  {compRows.filter((row) => row.tier === "exact").length} exact {formatPropertyType(subjectPropertyType).toLowerCase()} {compRows.filter((row) => row.tier === "exact").length === 1 ? "match" : "matches"}
                </p>
                <p className="mt-1 text-warning-content/80">
                  The rent estimate uses the exact matches. Upper-band units are
                  available below only to fill the report&apos;s comparable grid and
                  are clearly marked as secondary evidence.
                </p>
              </div>
            ) : null}

            {compRows.length > 0 ? (
              <ComparableFilters
                query={query}
                onQueryChange={setQuery}
                selectedOnly={selectedOnly}
                onSelectedOnlyChange={setSelectedOnly}
                totalCount={compRows.length}
                selectedCount={selectedIds.length}
                visibleCount={visibleCompRows.length}
              />
            ) : null}

            {compRows.length === 0 ? (
              <p role="status" className="rounded-xl border border-dashed border-base-300 bg-base-200/30 p-6 text-center text-sm leading-relaxed text-base-content/65">
                {fetchingComps ? "Searching for comparables… Results will appear here automatically." : "No comparables available. Fetch comparable evidence to get started."}
              </p>
            ) : visibleCompRows.length === 0 ? (
              <p role="status" className="rounded-xl border border-dashed border-base-300 bg-base-200/30 p-6 text-center text-sm leading-relaxed text-base-content/65">
                No comparables match this view. Clear the search or choose All to see more.
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
                        <p className="text-xs text-base-content/65">
                          {group.description}
                        </p>
                      </div>
                      <ul className="grid gap-3 md:grid-cols-2">
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
                                  "du-card du-card-border h-full w-full text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
                                  selected
                                    ? "border-primary bg-primary/5"
                                    : "border-base-300 bg-base-100 hover:border-primary/40 hover:bg-base-200/30",
                                )}
                              >
                                <div className="du-card-body grid w-full min-w-0 grid-cols-[4rem_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[5rem_minmax(0,1fr)] sm:p-4">
                                <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-base-200 text-base-content/35 sm:size-20">
                                  {comp.imageUrl ? (
                                    <Image
                                      src={comp.imageUrl}
                                      alt=""
                                      fill
                                      className="object-cover"
                                      sizes="80px"
                                      unoptimized
                                    />
                                  ) : <House size={24} aria-hidden="true" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="du-badge du-badge-sm du-badge-ghost h-auto min-h-5 py-0.5 text-[10px]">
                                      {propertyType}
                                    </span>
                                    {tier !== "exact" ? (
                                      <span
                                        className="du-badge du-badge-sm du-badge-warning h-auto min-h-5 whitespace-normal py-0.5 text-[10px]"
                                      >
                                        {tier === "upper_band_unit_fallback"
                                          ? "Secondary fallback"
                                          : "Nearby fallback"}
                                      </span>
                                    ) : (
                                      <span className="du-badge du-badge-sm du-badge-outline h-auto min-h-5 py-0.5 text-[10px]">
                                        Exact type
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-2 break-words text-sm font-medium leading-snug">
                                    {comp.address}
                                  </p>
                                  <p className="mt-2 text-base font-semibold tabular-nums">
                                    {rentRange(comp.weeklyRent, comp.weeklyRent, market)}
                                  </p>
                                  <p className="mt-0.5 text-xs text-base-content/65">
                                    {comp.bedrooms ?? "?"} bed · {comp.bathrooms ?? "?"} bath · {comp.carSpaces ?? "?"} car
                                    {comp.suburb ? ` · ${comp.suburb}` : ""}
                                  </p>
                                  <UsComparableDetails match={comp.usMatch} floorAreaSqm={comp.floorAreaSqm} />
                                </div>
                                <span className="col-span-2 flex items-center justify-between gap-3 border-t border-base-300/70 pt-2.5 text-xs font-medium">
                                  <span className={selected ? "text-primary" : "text-base-content/65"}>{selected ? "Included in report" : "Select comparable"}</span>
                                  <span className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", selected ? "bg-primary text-primary-content" : "border border-base-300 bg-base-100 text-base-content/55")}>
                                    {selected ? <Check size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                                  </span>
                                </span>
                                </div>
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


      </fieldset>
    </div>
  );
}


function formatPropertyType(value?: string) {
  const normalized = value?.trim() || "Property";
  return normalized
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

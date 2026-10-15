"use client";
import { UnsavedListingGuard } from "@/components/listings/UnsavedListingGuard";
import { AppraisalDataToolbar } from "@/components/appraisals/AppraisalDataToolbar";
import { ComparableFilters } from "@/components/appraisals/ComparableFilters";
import { UsComparableDetails, UsComparableSearchSummary } from "@/components/appraisals/UsComparableDetails";
import { avmPriceSuggestion } from "@/lib/listings/pricing";
import { formatEvidenceDate as formatSoldDate } from "@/lib/appraisals/formatEvidenceDate";

import { resolveAppraisalInput, appraisalInputError, hasStaleAppraisal } from "@/lib/appraisals/resolveAppraisalInput";

import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import Image from "next/image";
import { Check, House, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  hasSalesAppraisalComps,
} from "@/lib/sales-appraisal/generateSalesAppraisalForListing";
import {
  MAX_SALES_APPRAISAL_FEATURED_COMPS,
  defaultSelectedSaleCompListingIds,
  orderSalesAppraisalCompPool,
} from "@/lib/sales-appraisal/salesAppraisalData";
import { saleCompListingId } from "@/lib/sales-appraisal/saleCompIds";
import { formatSalePriceRange } from "@/lib/sales/computeSalePriceBand";
import type { SaleComp } from "@/lib/sales/types";
import { cn } from "@/lib/utils";
import type { Listing, SalesAppraisalJob } from "@/lib/types";

import type { AppraisalStepHandle, AppraisalStepSaveResult } from "@/components/appraisals/appraisalStepHandle";

const POLL_INTERVAL_MS = 2000;

type Props = {
  ref?: Ref<AppraisalStepHandle>;
  appraisalEndpoint?: string;
  onDirtyChange?: (dirty: boolean) => void;
  onBusyChange?: (busy: boolean) => void;
  listing: Listing;
  activeJob?: SalesAppraisalJob | null;
  compsPrefetching?: boolean;
  onListingChange: (listing: Listing) => void;
  onJobChange?: (job: SalesAppraisalJob | null) => void;
  onContinue: (listing?: Listing) => void;
  continueLabel?: string;
};

type ApiError = {
  error?: string;
};

export function SalesAppraisalDataStep({
  ref,
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
  const endpoint = appraisalEndpoint ?? `/api/listings/${listing.id}/sales-appraisal`;
  const parsed = useMemo(() => resolveAppraisalInput(listing), [listing]);
  const pool = useMemo(
    () => (parsed ? orderSalesAppraisalCompPool(parsed) : []),
    [parsed],
  );
  const appraisal = parsed?.salesAppraisal;
  const agencyGuideReview = appraisal?.agencyGuideReview;
  const jobProcessing =
    activeJob?.status === "pending" || activeJob?.status === "processing";
  const jobFailed = activeJob?.status === "failed";

  const priceEdited = useRef(false);
  const selectionEdited = useRef(false);
  const reviewEdited = useRef(false);
  const estimate = avmPriceSuggestion(listing, "sale");
  const hasPriceOverride = Boolean(listing.appraisal_overrides_json?.sales);
  const [query, setQuery] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const pollErrorShownRef = useRef(false);
  const jobCompletionToastRef = useRef<string | null>(null);
  const [priceMin, setPriceMin] = useState<string>(
    () => String(appraisal?.priceMin ?? ""),
  );
  const [priceMax, setPriceMax] = useState<string>(
    () => String(appraisal?.priceMax ?? ""),
  );
  const [priceMid, setPriceMid] = useState<string>(
    () => String(appraisal?.priceMidpoint ?? ""),
  );
  const [agentReviewConfirmed, setAgentReviewConfirmed] = useState(
    () => agencyGuideReview?.confirmed ?? false,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    if (appraisal?.selectedCompListingIds?.length) {
      return appraisal.selectedCompListingIds;
    }
    if (parsed) {
      return defaultSelectedSaleCompListingIds(parsed);
    }
    return [];
  });

  const evidenceDirty = priceMin !== String(appraisal?.priceMin ?? "") || priceMax !== String(appraisal?.priceMax ?? "") || priceMid !== String(appraisal?.priceMidpoint ?? "")
    || JSON.stringify(selectedIds) !== JSON.stringify(appraisal?.selectedCompListingIds?.length ? appraisal.selectedCompListingIds : defaultSelectedSaleCompListingIds(parsed)) || agentReviewConfirmed !== (agencyGuideReview?.confirmed ?? false);
  useEffect(() => { onDirtyChange?.(evidenceDirty); }, [evidenceDirty, onDirtyChange]);

  /* eslint-disable react-hooks/set-state-in-effect -- sync editable fields when job polling refreshes the listing. */
  useEffect(() => {
    if (!priceEdited.current) {
      setPriceMin(String(appraisal?.priceMin ?? ""));
      setPriceMax(String(appraisal?.priceMax ?? ""));
      setPriceMid(String(appraisal?.priceMidpoint ?? ""));
    }
    if (!reviewEdited.current) setAgentReviewConfirmed(agencyGuideReview?.confirmed ?? false);
    if (selectionEdited.current) {
      const availableIds = new Set(pool.map(saleCompListingId));
      setSelectedIds(current => current.filter(id => availableIds.has(id)));
    } else if (appraisal?.selectedCompListingIds?.length) {
      setSelectedIds(appraisal.selectedCompListingIds);
    } else if (parsed && pool.length > 0) {
      setSelectedIds(defaultSelectedSaleCompListingIds(parsed));
    }
  }, [listing.updated_at, appraisal, agencyGuideReview, parsed, pool]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const compRows = useMemo(
    () =>
      pool.map((comp, index) => ({
        comp,
        id: saleCompListingId(comp, index),
      })),
    [pool],
  );
  const visibleCompRows = compRows.filter(({ comp, id }) =>
    (!selectedOnly || selectedIds.includes(id)) &&
    `${comp.address} ${comp.suburb ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const discoveryGaps = [
    appraisal?.discovery?.sold && !appraisal.discovery.sold.targetMet
      ? `Sold: ${appraisal.discovery.sold.poolCount}/${appraisal.discovery.sold.targetCount} candidates, ${appraisal.discovery.sold.sameSuburbCount}/${appraisal.discovery.sold.targetSameSuburbCount} in ${listing.suburb ?? "the subject suburb"}`
      : null,
    appraisal?.discovery?.forSale && !appraisal.discovery.forSale.targetMet
      ? `For sale: ${appraisal.discovery.forSale.poolCount}/${appraisal.discovery.forSale.targetCount} candidates, ${appraisal.discovery.forSale.sameSuburbCount}/${appraisal.discovery.forSale.targetSameSuburbCount} in ${listing.suburb ?? "the subject suburb"}`
      : null,
  ].filter((message): message is string => Boolean(message));

  const priceSummary = useMemo(() => {
    const min = Number(priceMin);
    const max = Number(priceMax);
    if (Number.isFinite(min) && Number.isFinite(max) && min > 0 && max > 0) {
      return formatSalePriceRange(min, max);
    }
    const mid = Number(priceMid);
    if (Number.isFinite(mid) && mid > 0) {
      return formatSalePriceRange(mid, mid);
    }
    return null;
  }, [priceMin, priceMax, priceMid]);

  const inputError = appraisalInputError(listing);
  const staleEvidence = hasStaleAppraisal(listing, "sales");
  const compsReady = hasSalesAppraisalComps(parsed);
  const noCompsFound = activeJob?.status === "completed" && !compsReady && !staleEvidence && !inputError;
  const initialCompsProcessing = jobProcessing && !compsReady;
  const refreshingComps = jobProcessing && compsReady;
  const needsAgentReview = agencyGuideReview?.required === true;
  const canContinue =
    compsReady &&
    selectedIds.length > 0 &&
    (!needsAgentReview || agentReviewConfirmed);

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

        const nextJob = payload.job as SalesAppraisalJob | undefined;
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
                if (nextListing && hasSalesAppraisalComps(resolveAppraisalInput(nextListing))) {
                  toast.success("Sales comps updated");
                } else {
                  toast.info("Search completed without suitable comparables");
                }
              } else {
                toast.error(
                  nextJob.error_message ??
                    "Sales comps failed to update. Refresh comps to try again.",
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
    } else if (selectedIds.length >= MAX_SALES_APPRAISAL_FEATURED_COMPS) {
      toast.error(`Select up to ${MAX_SALES_APPRAISAL_FEATURED_COMPS} comparables`);
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
        throw new Error(payload.error ?? "Unable to fetch sales comps");
      }
      if (payload.listing) {
        onListingChange(payload.listing as Listing);
      }
      if (payload.job) {
        onJobChange?.(payload.job as SalesAppraisalJob);
      }
      if (!options?.silent) {
        toast.success(
          response.status === 202
            ? "Sales comps are updating in the background"
            : "Sales comps updated",
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to fetch sales comps",
      );
    } finally {
      setFetching(false);
    }
  }

  async function resetPrice() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const response = await fetch(`${endpoint}/data`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reset_price: true, ...(appraisalEndpoint ? { expected_updated_at: listing.updated_at } : {}) }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.listing) throw new Error(payload.error ?? "Unable to reset appraisal");
      priceEdited.current = false;
      onListingChange(payload.listing);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to reset appraisal");
    } finally { savingRef.current = false; setSaving(false); }
  }

  useEffect(() => {
    onBusyChange?.(saving || (Boolean(appraisalEndpoint) && fetching));
    return () => onBusyChange?.(false);
  }, [saving, fetching, appraisalEndpoint, onBusyChange]);

  useImperativeHandle(ref, () => ({ savePendingEdits: () => saveData(true) }));

  async function saveData(onlyIfDirty = false, continueAfterSave = false): Promise<AppraisalStepSaveResult> {
    if (savingRef.current) return "failed";
    if (onlyIfDirty && !evidenceDirty) return "unchanged";
    if (!canContinue) {
      toast.error("Fetch comps and select at least one comparable");
      return "failed";
    }

    savingRef.current = true;
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
              price_min: parsePrice(priceMin),
              price_max: parsePrice(priceMax),
              price_midpoint: parsePrice(priceMid),
            } : {}),
            selected_comp_listing_ids: selectedIds,
            agent_review_confirmed: needsAgentReview
              ? agentReviewConfirmed
              : undefined,
          }),
        },
      );
      const payload = (await response.json()) as ApiError & { listing?: Listing };
      if (!response.ok || !payload.listing) {
        throw new Error(payload.error ?? "Unable to save appraisal data");
      }
      selectionEdited.current = false;
      if (payload.listing) {
        onListingChange(payload.listing);
      }
      priceEdited.current = false;
      reviewEdited.current = false;
      toast.success("Appraisal data saved");
      if (continueAfterSave) onContinue(payload.listing);
      return "saved";
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save appraisal data",
      );
      return "failed";
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function saveAndContinue() {
    await saveData(false, true);
  }

  const loading = fetching || saving;
  const fetchingComps = compsPrefetching || fetching || initialCompsProcessing;

  return (
    <div data-theme="staypack-workspace" className="space-y-5 text-base-content">
      {appraisalEndpoint && <UnsavedListingGuard dirty={evidenceDirty} description="Your evidence changes are unsaved. Continue to proposal to save them." />}
      <AppraisalDataToolbar
        summary={priceSummary}
        selectedCount={selectedIds.length}
        maxSelected={MAX_SALES_APPRAISAL_FEATURED_COMPS}
        saving={saving}
        disabled={loading || !canContinue}
        guidance={inputError ?? (fetchingComps && !compsReady
          ? "Finding comparables. You can review the figures while we search."
          : !compsReady ? "Fetch comparable evidence below to continue."
          : selectedIds.length === 0 ? "Select at least one comparable below to continue." : needsAgentReview && !agentReviewConfirmed ? "Confirm the agency guide review below to continue."
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
              ? "Comparable sales are refreshing in the background. Current comps remain available while the appraisal updates."
              : `Review the suggested price range and choose up to six comparable properties. The most relevant recent sales and current listings appear first.`
            : jobProcessing
              ? "Comparable sales are being fetched in the background. This page will update when they are ready."
              : "Fetch recently sold and for-sale comparables to support your appraisal. Adjust the estimated sale price band if needed, then choose featured comps."}
        </p>
      </div>

      <div className="rounded-2xl border border-base-300 bg-base-100 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">Comparable sales</p>
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
            "Fetch sales comps"
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
              "Sales comps failed to update. Refresh comps to try again."}
          </p>
        ) : noCompsFound ? (
          <p role="status" className="mt-3 text-sm leading-relaxed text-base-content/65">
            No suitable comparable sales were found. Check the property details, then try fetching comparables again.
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
              <label className="block text-sm font-medium" htmlFor="price-min">Price min ($)</label>
              <input
                className="du-input du-input-sm min-h-12 w-full min-w-0 text-base font-medium tabular-nums"
                inputMode="decimal"
                id="price-min"
                type="number"
                min={0}
                value={priceMin}
                onChange={(e) => { priceEdited.current = true; setPriceMin(e.target.value); }}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium" htmlFor="price-max">Price max ($)</label>
              <input
                className="du-input du-input-sm min-h-12 w-full min-w-0 text-base font-medium tabular-nums"
                inputMode="decimal"
                id="price-max"
                type="number"
                min={0}
                value={priceMax}
                onChange={(e) => { priceEdited.current = true; setPriceMax(e.target.value); }}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-sm font-medium" htmlFor="price-mid">Price midpoint ($)</label>
              <input
                className="du-input du-input-sm min-h-12 w-full min-w-0 text-base font-medium tabular-nums"
                inputMode="decimal"
                id="price-mid"
                type="number"
                min={0}
                value={priceMid}
                onChange={(e) => { priceEdited.current = true; setPriceMid(e.target.value); }}
              />
            </div>
            {priceSummary ? (
              <p className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl bg-base-200/60 px-4 py-3 text-sm text-base-content/65 sm:col-span-3">
                Guide range: <span className="text-lg font-semibold tabular-nums text-base-content">{priceSummary}</span>
              </p>
            ) : null}
            {needsAgentReview ? (
              <div className="du-alert du-alert-warning block text-left text-sm sm:col-span-3">
                <p className="font-medium">Agent review required</p>
                <p className="mt-1 text-warning-content/80">
                  The agency guide of{" "}
                  {appraisal?.agencyGuide
                    ? formatSalePriceRange(
                        appraisal.agencyGuide.priceMin,
                        appraisal.agencyGuide.priceMax,
                      )
                    : "the displayed range"}{" "}
                  has been retained, but the automated comp range was{" "}
                  {appraisal?.compDerivedBand
                    ? formatSalePriceRange(
                        appraisal.compDerivedBand.priceMin,
                        appraisal.compDerivedBand.priceMax,
                      )
                    : "materially different"}
                  . Review the evidence before continuing.
                </p>
                {agencyGuideReview.reasons.length > 0 ? (
                  <ul className="mt-2 [list-style-type:disc] space-y-1 pl-5 text-warning-content/80">
                    {agencyGuideReview.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
                <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 rounded-lg bg-base-100/60 p-3 font-medium text-base-content">
                  <input
                    type="checkbox"
                    checked={agentReviewConfirmed}
                    onChange={(event) => {
                      reviewEdited.current = true;
                      setAgentReviewConfirmed(event.target.checked);
                    }}
                    className="du-toggle du-toggle-sm du-toggle-primary mt-0.5 shrink-0"
                  />
                  <span>I have reviewed the agency guide against the comparable evidence.</span>
                </label>
              </div>
            ) : null}
          </div>

          <div className="space-y-5 rounded-2xl border border-base-300 bg-base-100 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><h3 className="text-lg font-semibold">Featured comparables</h3><p className="mt-1 text-sm text-base-content/65">Choose the evidence that best supports your appraisal.</p></div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-base-content/65 sm:justify-end">
                <p>{compRows.length} candidates found</p>
                <p className="du-badge du-badge-sm h-auto min-h-7 py-1">
                  {selectedIds.length} / {MAX_SALES_APPRAISAL_FEATURED_COMPS} selected for the report
                </p>
              </div>
            </div>

            <UsComparableSearchSummary search={appraisal?.usSearch} />
            {discoveryGaps.length > 0 ? (
              <div role="status" className="du-alert du-alert-warning block text-left text-sm">
                <p className="font-medium">Comparable evidence is below target</p>
                <p className="mt-1 text-warning-content/80">
                  {discoveryGaps.join(" · ")}. Review the candidates carefully or
                  refresh before using the guide range.
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
              <ul className="grid gap-3 md:grid-cols-2">
                {visibleCompRows.map(({ comp, id }) => {
                  const selected = selectedIds.includes(id);
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
                            <SaleStatusBadge comp={comp} />
                            {comp.propertyType ? (
                              <span
                                className="du-badge du-badge-sm du-badge-outline h-auto min-h-5 py-0.5 text-[10px] capitalize text-base-content/65"
                              >
                                {comp.propertyType}
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 break-words text-sm font-medium leading-snug">
                            {comp.address}
                          </p>
                          <p className="mt-2 text-base font-semibold tabular-nums">{saleCompPriceLabel(comp)}</p>
                          <p className="mt-0.5 text-xs text-base-content/65">
                            {comp.bedrooms ?? "?"} bed
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
            )}
          </div>
      </>


      </fieldset>
    </div>
  );
}

function SaleStatusBadge({ comp }: { comp: SaleComp }) {
  if (comp.saleStatus === "sold") {
    return (
      <span className="du-badge du-badge-sm du-badge-success h-auto min-h-5 whitespace-normal py-0.5 text-left text-[10px] leading-snug">
        Recently sold{comp.soldDate ? ` · ${formatSoldDate(comp.soldDate)}` : ""}
      </span>
    );
  }
  return (
    <span className="du-badge du-badge-sm du-badge-ghost h-auto min-h-5 py-0.5 text-[10px]">
      For sale
    </span>
  );
}

function saleCompPriceLabel(comp: SaleComp) {
  if (comp.price > 0) {
    return formatSalePriceRange(comp.price, comp.price);
  }
  return comp.priceDisplay?.trim() || "Price undisclosed";
}

function parsePrice(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

"use client";
import { AppraisalDataToolbar } from "@/components/appraisals/AppraisalDataToolbar";
import { ComparableFilters } from "@/components/appraisals/ComparableFilters";
import { avmPriceSuggestion } from "@/lib/listings/pricing";

import { resolveAppraisalInput, appraisalInputError, hasStaleAppraisal } from "@/lib/appraisals/resolveAppraisalInput";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

const POLL_INTERVAL_MS = 2000;

type Props = {
  onBusyChange?: (busy: boolean) => void;
  listing: Listing;
  activeJob?: SalesAppraisalJob | null;
  compsPrefetching?: boolean;
  onListingChange: (listing: Listing) => void;
  onJobChange?: (job: SalesAppraisalJob | null) => void;
  onContinue: () => void;
  continueLabel?: string;
};

type ApiError = {
  error?: string;
};

export function SalesAppraisalDataStep({
  listing,
  activeJob = null,
  compsPrefetching = false,
  onListingChange,
  onJobChange,
  onContinue,
  continueLabel,
  onBusyChange,
}: Props) {
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
  const estimate = avmPriceSuggestion(listing, "sale");
  const hasPriceOverride = Boolean(listing.appraisal_overrides_json?.sales);
  const [query, setQuery] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [saving, setSaving] = useState(false);
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

  /* eslint-disable react-hooks/set-state-in-effect -- sync editable fields when job polling refreshes the listing. */
  useEffect(() => {
    if (!priceEdited.current) {
      setPriceMin(String(appraisal?.priceMin ?? ""));
      setPriceMax(String(appraisal?.priceMax ?? ""));
      setPriceMid(String(appraisal?.priceMidpoint ?? ""));
    }
    setAgentReviewConfirmed(agencyGuideReview?.confirmed ?? false);
    if (appraisal?.selectedCompListingIds?.length) {
      setSelectedIds(appraisal.selectedCompListingIds);
    } else if (parsed && pool.length > 0) {
      setSelectedIds(defaultSelectedSaleCompListingIds(parsed));
    }
  }, [listing.updated_at, appraisal, agencyGuideReview, parsed, pool.length]);
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
          `/api/listings/${listing.id}/sales-appraisal/jobs/${jobId}`,
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
    jobProcessing,
    onJobChange,
    onListingChange,
  ]);

  function toggleComp(id: string) {
    setSelectedIds((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }
      if (current.length >= MAX_SALES_APPRAISAL_FEATURED_COMPS) {
        toast.error(`Select up to ${MAX_SALES_APPRAISAL_FEATURED_COMPS} comparables`);
        return current;
      }
      return [...current, id];
    });
  }

  async function fetchComps(options?: { silent?: boolean }) {
    setFetching(true);
    try {
      const response = await fetch(`/api/listings/${listing.id}/sales-appraisal/enrich`, {
        method: "POST",
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
    setSaving(true);
    try {
      const response = await fetch(`/api/listings/${listing.id}/sales-appraisal/data`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reset_price: true }),
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
    onBusyChange?.(saving);
    return () => onBusyChange?.(false);
  }, [saving, onBusyChange]);

  async function saveAndContinue() {
    if (!canContinue) {
      toast.error("Fetch comps and select at least one comparable");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(
        `/api/listings/${listing.id}/sales-appraisal/data`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
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
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save appraisal data");
      }
      if (payload.listing) {
        onListingChange(payload.listing);
      }
      priceEdited.current = false;
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

  const loading = fetching || saving;
  const fetchingComps = compsPrefetching || fetching || initialCompsProcessing;

  return (
    <div className="space-y-6">
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
      <fieldset disabled={saving} className="min-w-0 space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Review appraisal evidence</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {compsReady
            ? refreshingComps
              ? "Comparable sales are refreshing in the background. Current comps remain available while the appraisal updates."
              : `Review the suggested price range and choose up to six comparable properties. The most relevant recent sales and current listings appear first.`
            : jobProcessing
              ? "Comparable sales are being fetched in the background. This page will update when they are ready."
              : "Recently sold and for-sale comparables load when you start the appraisal. Adjust the estimated sale price band if needed, then choose featured comps."}
        </p>
      </div>

      <div className="surface-card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">Comparable sales</p>
          {refreshingComps ? (
            <Badge variant="secondary">Refreshing</Badge>
          ) : compsReady ? (
            <Badge variant="secondary">Ready</Badge>
          ) : jobProcessing ? (
            <Badge variant="secondary">Fetching</Badge>
          ) : jobFailed ? (
            <Badge variant="destructive">Failed</Badge>
          ) : (
            <Badge variant="outline">{noCompsFound ? "No matches" : "Required"}</Badge>
          )}
        </div>

        <Button
          variant="outline"
          onClick={() => void fetchComps()}
          disabled={loading || compsPrefetching || jobProcessing || Boolean(inputError)}
        >
          {compsPrefetching || fetching || jobProcessing ? (
            <>
              <Loader2 className="animate-spin" />
              Fetching comps...
            </>
          ) : compsReady ? (
            "Refresh comps"
          ) : (
            "Fetch sales comps"
          )}
        </Button>
        </div>
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
              "Sales comps failed to update. Refresh comps to try again."}
          </p>
        ) : noCompsFound ? (
          <p role="status" className="text-sm text-muted-foreground">
            No suitable comparable sales were found. Check the property details, then try fetching comparables again.
          </p>
        ) : null}
      </div>

      {inputError ? <p role="alert" className="text-sm text-destructive">{inputError}</p> : staleEvidence ? <p role="status" className="text-sm text-muted-foreground">Property details changed. Fetch comparables again to update the appraisal.</p> : null}

      <>
          <div className="surface-card grid gap-4 p-6 sm:grid-cols-3">
            <div className="sm:col-span-3 space-y-2 text-sm">
              <p className="font-medium">{hasPriceOverride ? "Your appraisal override" : "Suggested appraisal"}</p>
              <p className="text-muted-foreground">Edit any amount below. Your saved figures are kept when comparables refresh.</p>
              {estimate && <p className="text-muted-foreground">Automated estimate: {estimate.display}{estimate.date ? ` · ${estimate.date}` : ""}{estimate.confidence ? ` · ${estimate.confidence} confidence` : ""}. This may be outdated; use your local knowledge.</p>}
              {hasPriceOverride && <Button type="button" variant="outline" disabled={loading || refreshingComps} onClick={resetPrice}>Use latest suggested appraisal</Button>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="price-min">Price min ($)</Label>
              <Input
                id="price-min"
                type="number"
                min={0}
                value={priceMin}
                onChange={(e) => { priceEdited.current = true; setPriceMin(e.target.value); }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price-max">Price max ($)</Label>
              <Input
                id="price-max"
                type="number"
                min={0}
                value={priceMax}
                onChange={(e) => { priceEdited.current = true; setPriceMax(e.target.value); }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price-mid">Price midpoint ($)</Label>
              <Input
                id="price-mid"
                type="number"
                min={0}
                value={priceMid}
                onChange={(e) => { priceEdited.current = true; setPriceMid(e.target.value); }}
              />
            </div>
            {priceSummary ? (
              <p className="text-sm text-muted-foreground sm:col-span-3">
                Guide range: <span className="font-medium text-foreground">{priceSummary}</span>
              </p>
            ) : null}
            {needsAgentReview ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50/80 px-4 py-3 text-sm text-amber-950 sm:col-span-3">
                <p className="font-medium">Agent review required</p>
                <p className="mt-1 text-amber-900/80">
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
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900/80">
                    {agencyGuideReview.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
                <label className="mt-3 flex cursor-pointer items-start gap-2 font-medium">
                  <input
                    type="checkbox"
                    checked={agentReviewConfirmed}
                    onChange={(event) =>
                      setAgentReviewConfirmed(event.target.checked)
                    }
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <span>I have reviewed the agency guide against the comparable evidence.</span>
                </label>
              </div>
            ) : null}
          </div>

          <div className="surface-card space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">Featured comparables</p>
              <div className="text-right text-sm text-muted-foreground">
                <p>{compRows.length} candidates found</p>
                <p>
                  {selectedIds.length} / {MAX_SALES_APPRAISAL_FEATURED_COMPS} selected for the report
                </p>
              </div>
            </div>

            {discoveryGaps.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
                <p className="font-medium">Comparable evidence is below target</p>
                <p className="mt-1 text-amber-900/80">
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
              <p className="text-sm text-muted-foreground">
                {fetchingComps ? "Searching for comparables… Results will appear here automatically." : "No comparables available. Fetch comparable evidence to get started."}
              </p>
            ) : visibleCompRows.length === 0 ? (
              <p role="status" className="text-sm text-muted-foreground">
                No comparables match this view. Clear the search or choose All to see more.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {visibleCompRows.map(({ comp, id }) => {
                  const selected = selectedIds.includes(id);
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        aria-pressed={selected}
                        onClick={() => toggleComp(id)}
                        className={cn(
                          "flex w-full gap-3 rounded-xl border p-3 text-left transition-colors",
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/40",
                        )}
                      >
                        <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md bg-muted">
                          {comp.imageUrl ? (
                            <Image
                              src={comp.imageUrl}
                              alt=""
                              fill
                              className="object-cover"
                              sizes="96px"
                              unoptimized
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <SaleStatusBadge comp={comp} />
                            {comp.propertyType ? (
                              <Badge
                                variant="outline"
                                className="capitalize text-muted-foreground"
                              >
                                {comp.propertyType}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm font-medium">
                            {comp.address}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {comp.bedrooms ?? "?"} bed · {saleCompPriceLabel(comp)}
                            {comp.suburb ? ` · ${comp.suburb}` : ""}
                          </p>
                        </div>
                        {selected ? (
                          <Check className="h-5 w-5 shrink-0 text-primary" />
                        ) : null}
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
      <Badge className="border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-300">
        Recently sold{comp.soldDate ? ` · ${formatSoldDate(comp.soldDate)}` : ""}
      </Badge>
    );
  }
  return (
    <Badge className="border-transparent bg-sky-100 text-sky-800 hover:bg-sky-100 dark:bg-sky-950 dark:text-sky-300">
      For sale
    </Badge>
  );
}

function saleCompPriceLabel(comp: SaleComp) {
  if (comp.price > 0) {
    return formatSalePriceRange(comp.price, comp.price);
  }
  return comp.priceDisplay?.trim() || "Price undisclosed";
}

function formatSoldDate(soldDate: string) {
  const parsed = new Date(soldDate);
  if (Number.isNaN(parsed.getTime())) {
    return soldDate;
  }
  return parsed.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function parsePrice(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

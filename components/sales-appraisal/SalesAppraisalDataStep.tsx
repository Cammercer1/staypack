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

const POLL_INTERVAL_MS = 10000;

type Props = {
  listing: Listing;
  activeJob?: SalesAppraisalJob | null;
  compsPrefetching?: boolean;
  onListingChange: (listing: Listing) => void;
  onJobChange?: (job: SalesAppraisalJob | null) => void;
  onContinue: () => void;
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
}: Props) {
  const parsed = listing.scraped_listing_json;
  const pool = useMemo(
    () => (parsed ? orderSalesAppraisalCompPool(parsed) : []),
    [parsed],
  );
  const appraisal = parsed?.salesAppraisal;
  const jobProcessing =
    activeJob?.status === "pending" || activeJob?.status === "processing";
  const jobFailed = activeJob?.status === "failed";

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
    setPriceMin(String(appraisal?.priceMin ?? ""));
    setPriceMax(String(appraisal?.priceMax ?? ""));
    setPriceMid(String(appraisal?.priceMidpoint ?? ""));
    if (appraisal?.selectedCompListingIds?.length) {
      setSelectedIds(appraisal.selectedCompListingIds);
    } else if (parsed && pool.length > 0) {
      setSelectedIds(defaultSelectedSaleCompListingIds(parsed));
    }
  }, [listing.updated_at, appraisal, parsed, pool.length]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const compRows = useMemo(
    () =>
      pool.map((comp, index) => ({
        comp,
        id: saleCompListingId(comp, index),
      })),
    [pool],
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

  const compsReady = hasSalesAppraisalComps(parsed);
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
                toast.success("Sales comps updated");
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
            price_min: parsePrice(priceMin),
            price_max: parsePrice(priceMax),
            price_midpoint: parsePrice(priceMid),
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
      title={fetchingComps ? "Fetching sales comps" : "Saving appraisal data"}
      description={
        fetchingComps
          ? "Searching recently sold and for-sale comparables. This can take 1–3 minutes."
          : "Saving your price band and comparable selection."
      }
      className="space-y-8"
    >
      <div>
        <h2 className="text-lg font-semibold">Appraisal data</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {compsReady
            ? refreshingComps
              ? "Comparable sales are refreshing in the background. Current comps remain available while the appraisal updates."
              : `Comps are sorted by relevance — same suburb, property type, and bed/bath match first. Recently sold and for-sale listings are mixed together; pick up to six for page 2 and use Refresh to re-fetch from REA.`
            : jobProcessing
              ? "Comparable sales are being fetched in the background. This page will update when they are ready."
              : "Recently sold and for-sale comparables load when you start the appraisal. Adjust the estimated sale price band if needed, then choose featured comps."}
        </p>
      </div>

      <div className="surface-card space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
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
            "Fetch sales comps"
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
              "Sales comps failed to update. Refresh comps to try again."}
          </p>
        ) : null}
      </div>

      {compsReady ? (
        <>
          <div className="surface-card grid gap-4 p-6 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="price-min">Price min ($)</Label>
              <Input
                id="price-min"
                type="number"
                min={0}
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price-max">Price max ($)</Label>
              <Input
                id="price-max"
                type="number"
                min={0}
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price-mid">Price midpoint ($)</Label>
              <Input
                id="price-mid"
                type="number"
                min={0}
                value={priceMid}
                onChange={(e) => setPriceMid(e.target.value)}
              />
            </div>
            {priceSummary ? (
              <p className="text-sm text-muted-foreground sm:col-span-3">
                Guide range: <span className="font-medium text-foreground">{priceSummary}</span>
              </p>
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

            {compRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No comparables returned — try refreshing comps.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {compRows.map(({ comp, id }) => {
                  const selected = selectedIds.includes(id);
                  return (
                    <li key={id}>
                      <button
                        type="button"
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

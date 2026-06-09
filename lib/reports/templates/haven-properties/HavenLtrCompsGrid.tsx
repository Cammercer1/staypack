import { BedDouble, Bath } from "lucide-react";
import type { LtrRentalCompCard } from "@/lib/types";
import { MAX_LEASE_APPRAISAL_FEATURED_COMPS } from "@/lib/lease-appraisal/leaseAppraisalData";
import { formatWeeklyRentRange } from "@/lib/rental/computeRentBand";
import { formatNumber } from "@/lib/reports/formatters";

/** Haven lease appraisal page 2 — matches STR comp count (2×3 grid). */
export const HAVEN_LTR_FEATURED_COMP_COUNT = MAX_LEASE_APPRAISAL_FEATURED_COMPS;
export const HAVEN_LTR_COMP_IMAGE_ASPECT = "aspect-[5/2]";

const DEFAULT_FEATURED = HAVEN_LTR_FEATURED_COMP_COUNT;

type Props = {
  comps: LtrRentalCompCard[];
  suburb?: string;
  totalCompCount?: number;
  featuredCount?: number;
  imageAspectClass?: string;
  compact?: boolean;
  /** Hide grey uppercase title and featured-count subline (page supplies its own heading). */
  hideHeader?: boolean;
};

export function HavenLtrCompsGrid({
  comps,
  suburb,
  totalCompCount,
  featuredCount = DEFAULT_FEATURED,
  imageAspectClass = HAVEN_LTR_COMP_IMAGE_ASPECT,
  compact = false,
  hideHeader = false,
}: Props) {
  const featured = comps.slice(0, featuredCount);
  const denseSix = compact && featured.length >= 6;

  if (featured.length === 0) {
    return (
      <p className="text-sm text-neutral-600">
        Comparable rental listings will appear here once market data is loaded.
      </p>
    );
  }

  const poolLabel =
    totalCompCount && totalCompCount > featured.length
      ? `Featured ${featured.length} of ${totalCompCount} comparable leases`
      : `${featured.length} comparable lease listing${featured.length === 1 ? "" : "s"}`;

  return (
    <div>
      {!hideHeader ? (
        <div className={compact ? "mb-3" : "mb-3"}>
          <p
            className={`font-semibold uppercase tracking-[0.14em] text-neutral-600 ${
              compact ? "text-[0.65rem]" : "text-[0.7rem]"
            }`}
            style={{ fontFamily: "var(--report-heading-font, inherit)" }}
          >
            Comparable rental listings
          </p>
          <p className={`text-neutral-600 ${compact ? "mt-0.5 text-[0.65rem]" : "mt-1 text-xs"}`}>
            {poolLabel}
            {suburb ? ` near ${suburb}` : ""}.
          </p>
        </div>
      ) : null}

      <div
        className={`grid grid-cols-2 ${denseSix ? "gap-2" : compact ? "gap-3" : "gap-5"}`}
      >
        {featured.map((comp) => (
          <article key={comp.listing_id || comp.name} className="min-w-0">
            {comp.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={comp.thumbnail_url}
                alt=""
                className={`${denseSix ? "aspect-[4/2]" : imageAspectClass} w-full object-cover`}
              />
            ) : (
              <div
                className={`${denseSix ? "aspect-[4/2]" : imageAspectClass} w-full bg-neutral-200`}
              />
            )}
            <div className={`space-y-0.5 ${denseSix ? "mt-1" : "mt-2"}`}>
              <p
                className={`font-semibold leading-snug text-neutral-900 ${
                  denseSix ? "text-[0.62rem]" : compact ? "text-[0.68rem]" : "text-xs"
                }`}
                style={{ fontFamily: "var(--report-body-font, inherit)" }}
              >
                {comp.name}
              </p>
              <div
                className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-neutral-600 ${
                  denseSix ? "text-[0.58rem]" : compact ? "text-[0.62rem]" : "text-[0.68rem]"
                }`}
              >
                {comp.weekly_rent != null ? (
                  <span className="font-semibold text-neutral-800">
                    {formatWeeklyRentRange(comp.weekly_rent, comp.weekly_rent)}
                  </span>
                ) : null}
                {comp.bedrooms != null ? (
                  <span className="inline-flex items-center gap-1">
                    <BedDouble className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                    {formatNumber(comp.bedrooms)}
                  </span>
                ) : null}
                {comp.bathrooms != null ? (
                  <span className="inline-flex items-center gap-1">
                    <Bath className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                    {formatNumber(comp.bathrooms)}
                  </span>
                ) : null}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

import { BedDouble, DollarSign, Percent } from "lucide-react";
import type { StrCompCard } from "@/lib/types";
import { formatCurrency, formatDistanceMeters, formatNumber, formatPercent } from "@/lib/reports/formatters";

export const STR_PAGE_TWO_FEATURED_COMP_COUNT = 4;
export const STR_PAGE_TWO_COMP_IMAGE_ASPECT = "aspect-[3/1]";

const DEFAULT_FEATURED_COMP_COUNT = STR_PAGE_TWO_FEATURED_COMP_COUNT;

type Props = {
  comps: StrCompCard[];
  suburb?: string;
  totalCompCount?: number;
  /** How many comp cards to render (default 4). */
  featuredCount?: number;
  /** Tailwind aspect class for comp photos (default 3:1 — wide, short). */
  imageAspectClass?: string;
  /** Override subtitle under "Comparable listings" (default derives from counts). */
  compPoolDescription?: string;
  /** Show the count/suburb line under the section heading (default true). */
  showPoolSubtitle?: boolean;
  /** Tighter grid for single-page layouts (e.g. Haven page 2). */
  compact?: boolean;
};

export function ClassicCompsGrid({
  comps,
  suburb,
  totalCompCount,
  featuredCount = DEFAULT_FEATURED_COMP_COUNT,
  imageAspectClass = STR_PAGE_TWO_COMP_IMAGE_ASPECT,
  compPoolDescription,
  showPoolSubtitle = true,
  compact = false,
}: Props) {
  const featured = comps.slice(0, featuredCount);

  if (featured.length === 0) {
    return (
      <p className="text-sm text-neutral-600">
        Run a detailed STR estimate to populate comparable listings on this page.
      </p>
    );
  }

  const compPoolLabel =
    compPoolDescription ??
    (totalCompCount && totalCompCount > featured.length
      ? `Top ${featured.length} of ${totalCompCount} comparable listings by estimated gross revenue`
      : `${featured.length} comparable listing${featured.length === 1 ? "" : "s"}`);

  return (
    <div>
      <div className={compact ? "mb-3" : "mb-3"}>
        <p
          className={`font-semibold uppercase tracking-[0.14em] text-neutral-600 ${
            compact ? "text-[0.65rem]" : "text-[0.7rem]"
          }`}
          style={{ fontFamily: "var(--report-heading-font, inherit)" }}
        >
          Comparable listings
        </p>
        {showPoolSubtitle ? (
          <p className={`text-neutral-600 ${compact ? "mt-0.5 text-[0.65rem]" : "mt-1 text-xs"}`}>
            {compPoolLabel}
            {suburb ? ` near ${suburb}` : ""}.
          </p>
        ) : null}
      </div>

      <div
        className={`grid ${compact ? "gap-3" : "gap-4"} ${
          featured.length <= 4 ? "grid-cols-2" : "grid-cols-3"
        }`}
      >
        {featured.map((comp) => (
          <article key={comp.listing_id || comp.name} className="min-w-0">
            {comp.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={comp.thumbnail_url}
                alt=""
                className={`${imageAspectClass} w-full object-cover`}
              />
            ) : (
              <div className={`${imageAspectClass} w-full bg-neutral-100`} />
            )}

            <div className={compact ? "pt-1.5" : "pt-2"}>
              {comp.distance_m != null ? (
                <p
                  className={`font-semibold uppercase tracking-wide text-neutral-600 ${
                    compact ? "text-[0.58rem]" : "text-[0.62rem]"
                  }`}
                  style={{ fontFamily: "var(--report-heading-font, inherit)" }}
                >
                  {formatDistanceMeters(comp.distance_m)} away
                </p>
              ) : null}

              <p
                className={`font-bold leading-snug text-neutral-900 ${
                  compact
                    ? "mt-0.5 line-clamp-2 text-[0.68rem]"
                    : "mt-1 text-[0.72rem]"
                }`}
                style={{ fontFamily: "var(--report-heading-font, inherit)" }}
              >
                {comp.name}
              </p>

              <div
                className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-neutral-800 ${
                  compact ? "mt-1 text-[0.58rem]" : "mt-2 gap-x-3 text-[0.62rem]"
                }`}
              >
                {comp.bedrooms != null ? (
                  <span className="inline-flex items-center gap-1">
                    <BedDouble className="h-3 w-3" strokeWidth={1.75} aria-hidden />
                    {formatNumber(comp.bedrooms)}
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1">
                  <DollarSign className="h-3 w-3" strokeWidth={1.75} aria-hidden />
                  {formatCurrency(comp.nightly_rate)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Percent className="h-3 w-3" strokeWidth={1.75} aria-hidden />
                  {formatPercent(comp.occupancy_rate)}
                </span>
              </div>

              <p
                className={`font-semibold leading-none ${
                  compact ? "mt-1 text-[0.78rem]" : "mt-2 text-[0.85rem]"
                }`}
                style={{
                  fontFamily: "var(--report-heading-font, inherit)",
                  color: "var(--report-text-colour, inherit)",
                }}
              >
                {formatCurrency(comp.annual_revenue)}
                <span
                  className={`ml-1 font-medium text-neutral-600 ${
                    compact ? "text-[0.55rem]" : "text-[0.6rem]"
                  }`}
                >
                  /yr gross
                </span>
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

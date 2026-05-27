import { BedDouble, DollarSign, Percent } from "lucide-react";
import type { StrCompCard } from "@/lib/types";
import { formatCurrency, formatDistanceMeters, formatNumber, formatPercent } from "@/lib/reports/formatters";

const FEATURED_COMP_COUNT = 3;

type Props = {
  comps: StrCompCard[];
  suburb?: string;
  totalCompCount?: number;
};

export function ClassicCompsGrid({ comps, suburb, totalCompCount }: Props) {
  const featured = comps.slice(0, FEATURED_COMP_COUNT);

  if (featured.length === 0) {
    return (
      <p className="text-sm text-neutral-600">
        Run a detailed STR estimate to populate comparable listings on this page.
      </p>
    );
  }

  const compPoolLabel =
    totalCompCount && totalCompCount > featured.length
      ? `Top ${featured.length} of ${totalCompCount} comparable listings`
      : `${featured.length} comparable listing${featured.length === 1 ? "" : "s"}`;

  return (
    <div>
      <div className="mb-3">
        <p
          className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-neutral-600"
          style={{ fontFamily: "var(--report-heading-font, inherit)" }}
        >
          Comparable listings
        </p>
        <p className="mt-1 text-xs text-neutral-600">
          {compPoolLabel}
          {suburb ? ` near ${suburb}` : ""}.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {featured.map((comp) => (
          <article key={comp.listing_id || comp.name} className="min-w-0">
            {comp.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={comp.thumbnail_url}
                alt=""
                className="aspect-[5/3] w-full object-cover"
              />
            ) : (
              <div className="aspect-[5/3] w-full bg-neutral-100" />
            )}

            <div className="pt-3">
              {comp.distance_m != null ? (
                <p
                  className="text-[0.62rem] font-semibold uppercase tracking-wide text-neutral-600"
                  style={{ fontFamily: "var(--report-heading-font, inherit)" }}
                >
                  {formatDistanceMeters(comp.distance_m)} away
                </p>
              ) : null}

              <p
                className="mt-1 text-[0.72rem] font-bold leading-snug text-neutral-900"
                style={{ fontFamily: "var(--report-heading-font, inherit)" }}
              >
                {comp.name}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.62rem] text-neutral-800">
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
                className="mt-2 text-[0.85rem] font-semibold leading-none"
                style={{
                  fontFamily: "var(--report-heading-font, inherit)",
                  color: "var(--report-text-colour, inherit)",
                }}
              >
                {formatCurrency(comp.annual_revenue)}
                <span className="ml-1 text-[0.6rem] font-medium text-neutral-600">/yr gross</span>
              </p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

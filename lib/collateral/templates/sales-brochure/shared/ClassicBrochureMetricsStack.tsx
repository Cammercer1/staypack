import { resolveLeaseBrochurePriceValue } from "@/lib/reports/resolveLeaseBrochurePriceValue";
import {
  resolveStrBrochurePriceLabel,
  resolveStrBrochurePriceValue,
} from "@/lib/reports/resolveStrBrochurePrice";
import { resolveBrochurePrice } from "@/lib/collateral/templates/types";
import type { BrochureDocumentJson } from "@/lib/collateral/templates/types";
import {
  isLeasePageVariant,
  isSalePageVariant,
  isStrPageVariant,
  resolveReportPageVariant,
  type ReportPageVariant,
} from "@/lib/reports/templates/shared/reportPageVariant";
import type { FinalReportJson } from "@/lib/types";

type MetricRow = {
  id: string;
  label: string;
  value: string;
  subline?: string;
};

function resolveClassicBrochureMetric(
  report: FinalReportJson,
  document: BrochureDocumentJson,
  reportVariant?: ReportPageVariant,
): MetricRow | null {
  const variant = resolveReportPageVariant(report, reportVariant);

  if (isSalePageVariant(variant)) {
    const listingPrice =
      report.property.display_price?.trim() || resolveBrochurePrice(document);
    if (!listingPrice) {
      return null;
    }
    return {
      id: "listing_price",
      label: "Price guide",
      value: listingPrice,
    };
  }

  if (isLeasePageVariant(variant)) {
    const leaseRent = resolveLeaseBrochurePriceValue(report);
    if (!leaseRent) {
      return null;
    }
    return {
      id: "lease_rent",
      label: "Indicative rent",
      value: leaseRent,
      subline: "per week",
    };
  }

  if (isStrPageVariant(variant)) {
    const strRevenue = resolveStrBrochurePriceValue(report);
    if (!strRevenue) {
      return null;
    }
    return {
      id: "str_revenue",
      label: resolveStrBrochurePriceLabel(),
      value: strRevenue,
      subline: "per year before costs",
    };
  }

  return null;
}

/** One headline metric on Classic page 1 — sale price, STR revenue, or lease rent. */
export function ClassicBrochureMetricsStack({
  report,
  document,
  reportVariant,
}: {
  report: FinalReportJson;
  document: BrochureDocumentJson;
  reportVariant?: ReportPageVariant;
}) {
  const metric = resolveClassicBrochureMetric(report, document, reportVariant);
  const metrics = metric ? [metric] : [];
  if (metrics.length === 0) {
    return null;
  }

  return (
    <div className="flex w-full min-w-[10.5rem] flex-col gap-2.5">
      {metrics.map((metric) => (
        <div
          key={metric.id}
          className="rounded-sm border border-neutral-200/80 px-3 py-2.5"
          style={{
            backgroundColor: "var(--report-soft-highlight, #f3f4f6)",
          }}
        >
          <p
            className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-neutral-600"
            style={{
              fontFamily:
                "var(--report-heading-font, var(--collateral-heading-font, inherit))",
            }}
          >
            {metric.label}
          </p>
          <p
            className="mt-1 text-[1.15rem] font-semibold leading-none tracking-tight"
            style={{
              fontFamily:
                "var(--report-heading-font, var(--collateral-heading-font, inherit))",
              color: "var(--report-text-colour, inherit)",
            }}
          >
            {metric.value}
          </p>
          {metric.subline ? (
            <p className="mt-1 text-[0.65rem] font-medium text-neutral-600">
              {metric.subline}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

"use client";

import type { ProposalData } from "@/lib/digital-proposals/data";
import type { ProposalBrand } from "@/lib/digital-proposals/brand";
import { ProposalDetailsPopover } from "./ProposalDetailsPopover";
import MonthlyRevenueChart from "./MonthlyRevenueChart";
import { MonthlyOccupancyChart } from "./MonthlyOccupancyChart";

export function YearlyForecast({ data, brand, motion }: { data: ProposalData; brand: ProposalBrand; motion: boolean }) {
  const hasRevenue = data.seasonality && [data.ltr.annualRent, data.str.market.annualRevenue, data.str.managed.annualRevenue].some(value => value !== null);
  return <>
    <div className="mt-6 grid min-w-0 gap-8 @min-[1000px]/proposal:grid-cols-2 @min-[1000px]/proposal:gap-10" data-testid="yearly-forecast-charts">
      {hasRevenue ? <MonthlyRevenueChart data={data} brand={brand} motion={motion} />
        : <div><h3 className="font-[family-name:var(--proposal-heading)] text-2xl">Revenue through the year</h3><p className="mt-4 text-sm text-(--proposal-muted)">Monthly revenue estimates are not available for this appraisal.</p></div>}
      {data.occupancy ? <MonthlyOccupancyChart occupancy={data.occupancy} brand={brand} motion={motion} />
        : <div><h3 className="font-[family-name:var(--proposal-heading)] text-2xl">Occupancy</h3><p className="mt-4 text-sm text-(--proposal-muted)">Monthly occupancy history is not available for this market.</p></div>}
    </div>
    <div className="mt-3 border-t border-current/15 pt-2">
      <ProposalDetailsPopover label="About these figures" title="About these figures" brand={brand}>
      <p className="mt-2 max-w-3xl leading-relaxed">Estimated gross revenue is before fees and operating costs. Both STR scenarios follow the saved seasonal revenue pattern; long-term rent is spread evenly. Rounded monthly figures add up to the annual estimates.</p>
      {data.occupancy && <p className="mt-2 max-w-3xl leading-relaxed">Occupancy shows saved historical market averages{data.occupancy.label ? ` for ${data.occupancy.label}` : ""}, not a forecast for this property. {data.occupancy.allPropertyTypes ? "The benchmark includes all property types with the same bedroom count. " : ""}Missing months are left blank.</p>}
      </ProposalDetailsPopover>
    </div>
  </>;
}

import type { ProposalData } from "@/lib/digital-proposals/data";

const dollars = (value: number) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(value);

export function EstimateAssumptions({ data }: { data: ProposalData }) {
  const market = data.str.market.annualRevenue;
  const managed = data.str.managed.annualRevenue;
  const uplift = market !== null && market > 0 && managed !== null ? (managed / market - 1) * 100 : null;
  return <details className="du-collapse du-collapse-plus rounded-none border-t border-base-300 bg-base-100 text-base-content">
    <summary className="du-collapse-title min-h-12 py-3 pl-0 text-sm font-medium text-primary">How this estimate is prepared</summary>
    <div className="du-collapse-content space-y-3 px-0 text-sm leading-relaxed text-base-content/75">
      {uplift !== null && uplift > 0 && <p>The estimated annual gross STR revenue of {dollars(managed!)} combines a {dollars(market!)} market estimate with an assumed {new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 }).format(uplift)}% management uplift. This is a planning assumption, not a measure of past performance or a guaranteed increase.</p>}
      <p>The market estimate considers the property and surrounding rental market. Nearby listings provide context; their revenues are not simply averaged to produce this estimate.</p>
      <p>Presentation, guest capacity, pricing, permitted use and nights available can all affect results. Estimates are before management fees and operating costs; the letting plan and assumptions should be confirmed before proceeding.</p>
    </div>
  </details>;
}

export function ComparableContext({ data }: { data: ProposalData }) {
  const bedrooms = data.comparables.flatMap(comp => comp.bedrooms === null ? [] : [comp.bedrooms]);
  const min = bedrooms.length ? Math.min(...bedrooms) : null;
  const max = bedrooms.length ? Math.max(...bedrooms) : null;
  const differs = data.property.bedrooms !== null && min !== null && max !== null && (data.property.bedrooms < min || data.property.bedrooms > max);
  return <p className="mb-5! max-w-3xl text-sm leading-relaxed text-base-content/70">
    {differs && <>This property has {data.property.bedrooms} bedrooms; the nearby listings shown have {min === max ? min : `${min}–${max}`}. </>}
    The listing estimates below exclude the management uplift included in your rental appraisal.
  </p>;
}

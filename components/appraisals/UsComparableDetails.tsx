import type { UsComparableMatch, UsComparableSearch } from "@/lib/us-property/comparableTypes";

export function UsComparableSearchSummary({ search }: { search?: UsComparableSearch }) {
  if (!search) return null;
  return <div className="rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
    <p>{search.returnedCount} matches · {search.radiusMiles == null ? "Same ZIP code" : `Searched within ${search.radiusMiles} ${search.radiusMiles === 1 ? "mile" : "miles"}`} · Ranked by proximity and property similarity.</p>
    <p className="mt-1">{search.kind === "lease" ? "Advertised monthly rents; signed lease amounts may differ." : "Reported sold prices from the last 12 months; newer sales rank higher."}</p>
    {!search.targetMet && <p className="mt-1 text-amber-800">Fewer than 20 relevant matches were available. Review the evidence before selecting report comparables.</p>}
    {(search.stopReason === "request_failed" || search.stopReason === "time_limit") && <p className="mt-1 text-amber-800">The search stopped early. Available matches have been kept; refresh to try again.</p>}
  </div>;
}

export function UsComparableDetails({ match, floorAreaSqm }: { match?: UsComparableMatch; floorAreaSqm?: number }) {
  if (!match) return null;
  const facts = [match.distanceMiles == null ? null : `${match.distanceMiles.toFixed(2)} mi away`,
    floorAreaSqm ? `${Math.round(floorAreaSqm / 0.09290304).toLocaleString("en-US")} sq ft` : null].filter(Boolean);
  return <>
    {facts.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{facts.join(" · ")}</p>}
    {match.notes.length > 0 && <p className="mt-1 text-xs text-amber-800">{match.notes.join(" · ")}</p>}
  </>;
}

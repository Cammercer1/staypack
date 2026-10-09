"use client";

import { Search } from "lucide-react";

type Props = {
  query: string;
  onQueryChange: (query: string) => void;
  selectedOnly: boolean;
  onSelectedOnlyChange: (selectedOnly: boolean) => void;
  totalCount: number;
  selectedCount: number;
  visibleCount: number;
};

export function ComparableFilters({
  query,
  onQueryChange,
  selectedOnly,
  onSelectedOnlyChange,
  totalCount,
  selectedCount,
  visibleCount,
}: Props) {
  return (
    <div
      data-theme="staypack-workspace"
      className="space-y-3 text-base-content"
    >
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 space-y-1 text-sm">
          <span className="font-medium">Search comparables</span>
          <span className="du-input du-input-sm min-h-11 w-full">
            <Search className="size-4 shrink-0" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Address or suburb"
              className="min-w-0"
            />
          </span>
        </label>
        <div
          role="group"
          aria-label="Filter comparables"
          className="flex flex-wrap gap-2"
        >
          <button
            type="button"
            aria-pressed={!selectedOnly}
            className="du-btn du-btn-sm min-h-11 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-content"
            onClick={() => onSelectedOnlyChange(false)}
          >
            All ({totalCount})
          </button>
          <button
            type="button"
            aria-pressed={selectedOnly}
            className="du-btn du-btn-sm min-h-11 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-content"
            onClick={() => onSelectedOnlyChange(true)}
          >
            Selected ({selectedCount})
          </button>
        </div>
      </div>
      <p role="status" className="text-xs">
        {visibleCount} {visibleCount === 1 ? "comparable" : "comparables"}{" "}
        shown. Select up to six for the report; deselect one to replace it.
      </p>
    </div>
  );
}

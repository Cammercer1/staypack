export type UsComparableMatch = {
  /** Relative selection score, not valuation confidence. */
  score: number;
  distanceMiles?: number;
  notes: string[];
};

export type UsComparableSearch = {
  kind: "lease" | "sales";
  observedAt: string;
  targetCount: number;
  minimumCount: number;
  returnedCount: number;
  reviewedCount: number;
  requestCount: number;
  radiusMiles?: number;
  targetMet: boolean;
  stopReason: "target_met" | "coverage_limit" | "request_failed" | "time_limit" | "missing_subject";
  /** Original provider records for the retained candidates, separate from ranking. */
  rawComparables: Record<string, unknown>[];
};

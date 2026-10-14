import type { UsComparableMatch } from "./comparableTypes";

/** Preserve geographic ranking through the review screen and default report selection. */
export function orderUsComparablePool<T extends { usMatch?: UsComparableMatch }>(pool: T[]) {
  return [...pool].sort((a, b) => (b.usMatch?.score ?? -1) - (a.usMatch?.score ?? -1));
}

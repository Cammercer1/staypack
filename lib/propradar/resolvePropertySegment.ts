export type PropRadarPropertySegment = "house" | "unit";

/** Map listing property type to PropRadar suburb medians / yields segment. */
export function resolvePropRadarPropertySegment(propertyType?: string): PropRadarPropertySegment {
  const normalized = propertyType?.trim().toLowerCase() ?? "";

  if (
    normalized.includes("apartment") ||
    normalized.includes("unit") ||
    normalized.includes("studio") ||
    normalized.includes("flat")
  ) {
    return "unit";
  }

  if (
    normalized.includes("house") ||
    normalized.includes("townhouse") ||
    normalized.includes("villa") ||
    normalized.includes("duplex") ||
    normalized.includes("terrace")
  ) {
    return "house";
  }

  return "unit";
}

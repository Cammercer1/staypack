export function formatCurrency(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  return `${Math.round(value)}%`;
}

export function formatNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-AU").format(value);
}

/** Fixed en-AU short labels — avoids SSR/client `toLocaleDateString` mismatches (e.g. Jun vs June). */
const SHORT_MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatMonthLabel(monthKey: string) {
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return monthKey;
  }

  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) {
    return monthKey;
  }

  return SHORT_MONTH_LABELS[monthIndex]!;
}

export function formatDistanceMeters(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return null;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)} km`;
  }

  return `${Math.round(value)} m`;
}

export function calculateAccommodates(
  bedrooms?: number | null,
  accommodates?: number | null,
) {
  if (accommodates && accommodates >= 2) {
    return Math.min(accommodates, 10);
  }

  const fromBedrooms = (bedrooms ?? 1) * 2;
  return Math.min(Math.max(fromBedrooms, 2), 10);
}

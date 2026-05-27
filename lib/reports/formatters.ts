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

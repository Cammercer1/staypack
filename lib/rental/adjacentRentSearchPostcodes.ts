/** REA accepts semicolon-separated postcodes in rent SERP paths (e.g. 6020;6019;6021). */
export function adjacentRentSearchPostcodes(postcode: string): string[] {
  const trimmed = postcode.trim();
  const value = Number.parseInt(trimmed, 10);
  if (!Number.isFinite(value) || value < 200 || value > 9998) {
    return [];
  }

  const format = (n: number) => String(n).padStart(trimmed.length, "0");
  return [format(value - 1), format(value + 1)];
}

export function formatReaRentPostcodeSegment(
  primary: string,
  additionalPostcodes?: string[],
): string {
  const parts = [
    primary.trim(),
    ...(additionalPostcodes ?? []).map((row) => row.trim()),
  ].filter(Boolean);

  return [...new Set(parts)].join(";");
}

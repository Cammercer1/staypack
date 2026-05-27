export function cacheBustedPdfUrl(url: string, version: string | number) {
  const base = url.split("?")[0]!;
  return `${base}?v=${encodeURIComponent(String(version))}`;
}

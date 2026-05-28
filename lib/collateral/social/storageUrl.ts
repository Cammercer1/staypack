/** Append a cache-busting query param so CDNs/browsers fetch the latest file. */
export function withStorageCacheBust(publicUrl: string, version: string | number) {
  const url = new URL(publicUrl);
  url.searchParams.set("v", String(version));
  return url.toString();
}

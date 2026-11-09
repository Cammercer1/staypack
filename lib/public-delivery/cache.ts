/** Isolate-local, bounded cache for immutable snapshots. Access decisions always bypass it. */
export function snapshotCache(fetcher: typeof fetch, now = Date.now, maxBytes = 8 * 1024 * 1024): typeof fetch {
  const entries = new Map<string, { body: string; bytes: number; expires: number }>();
  let bytes = 0;
  return async (input, init) => {
    const ttl = init?.next?.revalidate;
    if (init?.cache !== "force-cache" || typeof ttl !== "number" || ttl <= 0 || (init.method && init.method !== "GET")) {
      return fetcher(input, init);
    }
    const key = String(input);
    const saved = entries.get(key);
    if (saved && saved.expires > now()) {
      entries.delete(key); entries.set(key, saved);
      return new Response(saved.body, { headers: { "Content-Type": "application/json" } });
    }
    if (saved) { bytes -= saved.bytes; entries.delete(key); }
    const response = await fetcher(input, init);
    if (response.status !== 200) return response;
    const body = await response.text();
    const size = new TextEncoder().encode(body).byteLength;
    if (size <= maxBytes / 2) {
      // A concurrent read of this key may have completed while this fetch was pending.
      const previous = entries.get(key);
      if (previous) { bytes -= previous.bytes; entries.delete(key); }
      while (bytes + size > maxBytes && entries.size) {
        const oldest = entries.keys().next().value!;
        bytes -= entries.get(oldest)!.bytes; entries.delete(oldest);
      }
      entries.set(key, { body, bytes: size, expires: now() + Math.min(ttl, 86400) * 1000 }); bytes += size;
    }
    return new Response(body, { status: response.status, headers: response.headers });
  };
}

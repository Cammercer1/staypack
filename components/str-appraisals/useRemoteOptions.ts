"use client";
import { useEffect, useState } from "react";

export async function readPrivateResponse(response: Response) {
  if (response.redirected) throw new Error("Your session expired. Sign in again before saving.");
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to complete this request.");
  return result;
}

export function useRemoteOptions<T>(url: string, key: string, enabled = true) {
  const [result, setResult] = useState<{ url: string; data: T[]; error: string | null; loading: boolean }>({ url: "", data: [], error: null, loading: false });
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setResult({ url, data: [], error: null, loading: true });
      try {
        const payload = await readPrivateResponse(await fetch(url, { signal: controller.signal, cache: "no-store" }));
        if (!controller.signal.aborted) setResult({ url, data: payload[key] ?? [], error: null, loading: false });
      } catch (cause) {
        if (!controller.signal.aborted) setResult({ url, data: [], error: cause instanceof Error ? cause.message : "Unable to load options.", loading: false });
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [url, key, enabled]);
  return enabled && result.url === url ? result : { data: [] as T[], error: null, loading: enabled };
}

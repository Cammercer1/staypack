"use client";
import { useEffect, useState } from "react";

export async function readPrivateResponse(response: Response) {
  if (response.redirected) throw new Error("Your session expired. Sign in again before saving.");
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Unable to complete this request.");
  return result;
}

export function useRemoteOptions<T>(url: string, key: string, enabled = true) {
  const [data, setData] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await readPrivateResponse(await fetch(url, { signal: controller.signal, cache: "no-store" }));
        if (!controller.signal.aborted) setData(result[key] ?? []);
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load options.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [url, key, enabled]);
  return { data, error, loading };
}

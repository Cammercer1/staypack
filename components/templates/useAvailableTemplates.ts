"use client";

import { useEffect, useState } from "react";
import type { TemplateApiEntry } from "@/lib/templates/serializeForApi";
import type { TemplateProduct } from "@/lib/templates/types";

export type TemplatesResponse = {
  default_template_id: string;
  templates: TemplateApiEntry[];
};

export function useAvailableTemplates(
  product: TemplateProduct,
  initialData?: TemplatesResponse,
) {
  const [reloadKey, setReloadKey] = useState(0);
  const [data, setData] = useState<TemplatesResponse | null>(
    initialData ?? null,
  );
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData && reloadKey === 0) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/templates?product=${product}`);
        const payload = (await response.json()) as TemplatesResponse & {
          error?: string;
        };
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load templates");
        }
        if (!cancelled) {
          setData(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load templates",
          );
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [product, reloadKey, initialData]);

  return {
    data: initialData && reloadKey === 0 ? initialData : data,
    loading: initialData && reloadKey === 0 ? false : loading,
    error,
    reload: () => setReloadKey((key) => key + 1),
  };
}

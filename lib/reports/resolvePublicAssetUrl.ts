import { getSiteUrl } from "@/lib/env";

/** Turn `/public/...` paths into absolute URLs for PDF mirroring and email clients. */
export function resolvePublicAssetUrl(pathOrUrl: string): string {
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  const base = getSiteUrl().replace(/\/$/, "");
  return `${base}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

import { getPrintRenderBaseUrl, isDevelopment } from "@/lib/env";

/** Render this release's print page, without trusting arbitrary request hosts. */
export function proposalPrintOrigin(requestUrl?: string) {
  const fallback = getPrintRenderBaseUrl();
  if (!requestUrl) return fallback;
  try {
    const url = new URL(requestUrl);
    if (url.username || url.password) return fallback;
    if (isDevelopment() && ["localhost", "127.0.0.1"].includes(url.hostname)) return url.origin;
    if (url.protocol !== "https:" || url.port) return fallback;
    if (url.origin === new URL(fallback).origin) return url.origin;
    const siteName = process.env.SITE_NAME;
    if (siteName && (url.hostname === `${siteName}.netlify.app` || url.hostname.endsWith(`--${siteName}.netlify.app`))) return url.origin;
  } catch { /* Use the configured site for malformed origins. */ }
  return fallback;
}

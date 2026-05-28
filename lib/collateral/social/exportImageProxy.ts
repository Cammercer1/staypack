const PROXY_PATH = "/api/collateral/export-image";

/** Same-origin proxy for listing/agency images during PNG capture (avoids CORS). */
export function buildCollateralExportImageProxyUrl(imageUrl: string) {
  return `${PROXY_PATH}?url=${encodeURIComponent(imageUrl)}`;
}

export function shouldProxyImageForExport(url: string) {
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) {
    return false;
  }
  if (typeof window === "undefined") {
    return url.startsWith("http");
  }
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin !== window.location.origin;
  } catch {
    return false;
  }
}

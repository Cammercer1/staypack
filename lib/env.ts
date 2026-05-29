/** Hostnames that should never be used for new public/QR URLs. */
const LEGACY_SITE_HOSTS = new Set([
  "staypack.netlify.app",
  "localhost",
]);
const CANONICAL_PUBLIC_SITE_URL = "https://staypack.app";

function normalizeSiteUrl(url: string) {
  return url.trim().replace(/\/$/, "");
}

function hostFromUrl(url: string) {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
  } catch {
    return null;
  }
}

/** True when a stored public URL should be replaced with the canonical site URL. */
export function isLegacyPublicUrlHost(hostname: string, canonicalHostname: string) {
  if (LEGACY_SITE_HOSTS.has(hostname)) return true;
  if (hostname.startsWith("127.")) return true;
  if (
    hostname.endsWith(".netlify.app") &&
    canonicalHostname &&
    !canonicalHostname.endsWith(".netlify.app")
  ) {
    return true;
  }
  return Boolean(canonicalHostname && hostname !== canonicalHostname);
}

/**
 * Canonical site origin for public links and QR codes.
 * Prefer server/runtime SITE_URL, then NEXT_PUBLIC_SITE_URL, then Netlify custom domain (DEPLOY_PRIME_URL).
 */
export function getSiteUrl() {
  let resolved: string;

  const siteUrl = process.env.SITE_URL?.trim();
  const nextPublic = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (siteUrl) {
    resolved = siteUrl;
  } else if (nextPublic) {
    resolved = nextPublic;
  } else if (process.env.DEPLOY_PRIME_URL) {
    resolved = process.env.DEPLOY_PRIME_URL.startsWith("http")
      ? process.env.DEPLOY_PRIME_URL
      : `https://${process.env.DEPLOY_PRIME_URL}`;
  } else if (process.env.URL) {
    resolved = process.env.URL.startsWith("http")
      ? process.env.URL
      : `https://${process.env.URL}`;
  } else if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    resolved = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  } else if (process.env.VERCEL_URL) {
    resolved = `https://${process.env.VERCEL_URL}`;
  } else {
    resolved = "http://localhost:3000";
  }

  const normalized = normalizeSiteUrl(resolved);
  const normalizedHost = hostFromUrl(normalized);

  // If we fell back to a legacy Netlify host but explicit env points at production, prefer production.
  const resolvedHost = normalizedHost;
  if (
    resolvedHost &&
    LEGACY_SITE_HOSTS.has(resolvedHost) === false &&
    resolvedHost.endsWith(".netlify.app") &&
    nextPublic &&
    !hostFromUrl(nextPublic)?.endsWith(".netlify.app")
  ) {
    resolved = nextPublic;
  }

  let finalUrl = normalizeSiteUrl(resolved);
  const finalHost = hostFromUrl(finalUrl);
  const isLegacyHost =
    Boolean(finalHost && LEGACY_SITE_HOSTS.has(finalHost)) ||
    Boolean(finalHost?.startsWith("127."));
  if (isLegacyHost) {
    finalUrl = CANONICAL_PUBLIC_SITE_URL;
  }

  return finalUrl;
}

export function getReportsUrl() {
  const reports = process.env.NEXT_PUBLIC_REPORTS_URL?.trim();
  if (reports) return normalizeSiteUrl(reports);
  return getSiteUrl();
}

export function isDevelopment() {
  return (process.env.APP_ENV ?? "development") === "development";
}

export function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function hasServiceRoleKey() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getGoogleMapsApiKey() {
  return process.env.GOOGLE_MAPS_API_KEY ?? null;
}

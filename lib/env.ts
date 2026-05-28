export function getSiteUrl() {
  let resolved: string;
  let source: string;
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    resolved = process.env.NEXT_PUBLIC_SITE_URL;
    source = "NEXT_PUBLIC_SITE_URL";
  } else if (process.env.URL) {
    // Netlify production/preview URL (no protocol)
    resolved = process.env.URL.startsWith("http")
      ? process.env.URL
      : `https://${process.env.URL}`;
    source = "URL";
  } else if (process.env.DEPLOY_PRIME_URL) {
    resolved = process.env.DEPLOY_PRIME_URL.startsWith("http")
      ? process.env.DEPLOY_PRIME_URL
      : `https://${process.env.DEPLOY_PRIME_URL}`;
    source = "DEPLOY_PRIME_URL";
  } else if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    resolved = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
    source = "VERCEL_PROJECT_PRODUCTION_URL";
  } else if (process.env.VERCEL_URL) {
    resolved = `https://${process.env.VERCEL_URL}`;
    source = "VERCEL_URL";
  } else {
    resolved = "http://localhost:3000";
    source = "fallback";
  }
  // #region agent log
  fetch("http://127.0.0.1:7740/ingest/66655b5b-7303-4147-9dce-5926d720dd8f", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "a515ca",
    },
    body: JSON.stringify({
      sessionId: "a515ca",
      location: "lib/env.ts:getSiteUrl",
      message: "getSiteUrl resolved",
      data: {
        source,
        resolved,
        hasNextPublicSiteUrl: Boolean(process.env.NEXT_PUBLIC_SITE_URL),
        urlEnv: process.env.URL ?? null,
        deployPrimeUrl: process.env.DEPLOY_PRIME_URL ?? null,
      },
      timestamp: Date.now(),
      hypothesisId: "H5",
    }),
  }).catch(() => {});
  // #endregion
  return resolved.replace(/\/$/, "");
}

export function getReportsUrl() {
  return process.env.NEXT_PUBLIC_REPORTS_URL ?? getSiteUrl();
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

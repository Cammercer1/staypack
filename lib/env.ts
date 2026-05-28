export function getSiteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL;
  }
  // Vercel sets VERCEL_PROJECT_PRODUCTION_URL (stable custom domain) or VERCEL_URL (preview)
  const vercelProd = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercelProd) return `https://${vercelProd}`;
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`;
  return "http://localhost:3000";
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

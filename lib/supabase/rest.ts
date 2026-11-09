import "server-only";

/** Lightweight server-only REST access for public readers; never import the auth SDK here. */
export function databaseRequest(table: string, query: Record<string, string>) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Missing Supabase service role configuration");
  return {
    url: `${base}/rest/v1/${table}?${new URLSearchParams(query)}`,
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  };
}

/** Host is the browser-facing authority; Request.url can use a container host. */
export function requestOriginAllowed(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("origin");
  if (!origin) return true; // Authenticated non-browser clients do not send Origin.
  try {
    const source = new URL(origin);
    const target = new URL(request.url);
    const host = request.headers.get("host") ?? target.host;
    const forwarded = request.headers.get("x-forwarded-proto");
    const protocol = forwarded === "https" || forwarded === "http" ? `${forwarded}:` : target.protocol;
    return source.origin === origin && source.host === host && source.protocol === protocol;
  } catch { return false; }
}

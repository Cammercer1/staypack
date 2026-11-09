type PreviewEnvironment = {
  BRANCH_PREVIEW_ACCESS_KEY?: string;
  RELEASE_SHA?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  ASSETS?: { fetch(request: Request): Promise<Response> };
  [name: string]: unknown;
};

const privateHeaders = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow, noarchive" };

async function matchesSecret(actual: string, expected: string) {
  const digest = (value: string) => crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const [left, right] = await Promise.all([digest(actual), digest(expected)]);
  const a = new Uint8Array(left), b = new Uint8Array(right);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}

/** A UI sandbox only: no database, provider credentials, jobs or production bindings. */
export function branchPreviewHandler(application: (request: Request) => Promise<Response>) {
  return async (request: Request, env: PreviewEnvironment) => {
    const unsafe = Object.keys(env).some(name => /(?:SERVICE_ROLE|API_KEY|R2_|STRIPE_|RESEND_|APPRAISAL_JOBS|CRON_SECRET)|^PUBLIC_REPORTS$/.test(name));
    if (unsafe || env.NEXT_PUBLIC_SUPABASE_URL !== "https://preview.invalid" || !env.BRANCH_PREVIEW_ACCESS_KEY) {
      return new Response("Preview is not configured", { status: 503, headers: privateHeaders });
    }
    let provided = request.headers.get("x-staypack-preview-key") ?? "";
    const authorization = request.headers.get("authorization") ?? "";
    if (authorization.startsWith("Basic ")) {
      try {
        const credentials = atob(authorization.slice(6));
        if (credentials.startsWith("preview:")) provided = credentials.slice(8);
      } catch { /* Invalid credentials remain unauthorized. */ }
    }
    if (!(await matchesSecret(provided, env.BRANCH_PREVIEW_ACCESS_KEY))) {
      return new Response("Private StayPack preview", { status: 401, headers: { ...privateHeaders, "WWW-Authenticate": 'Basic realm="StayPack branch preview", charset="UTF-8"' } });
    }
    const url = new URL(request.url);
    const headers = new Headers(privateHeaders);
    headers.set("X-StayPack-Preview", "synthetic-data-only");
    headers.set("X-StayPack-Revision", String(env.RELEASE_SHA ?? "local"));
    if (url.pathname === "/__preview/health") return Response.json({ mode: "synthetic-data-only", database: false, jobs: false, revision: env.RELEASE_SHA ?? "local" }, { headers });
    if (!["GET", "HEAD"].includes(request.method)) return new Response("Preview writes are local to your browser", { status: 405, headers });
    if (url.pathname === "/") return new Response(null, { status: 302, headers: { ...Object.fromEntries(headers), Location: "/dev/branch-preview" } });
    const page = ["/dev/branch-preview", "/dev/lint-regression", "/dev/lint-regression/l/mock", "/dev/document-print"].includes(url.pathname);
    const asset = !url.pathname.startsWith("/api/") && /\.(?:js|css|png|jpg|jpeg|webp|svg|ico|woff|woff2|ttf)$/.test(url.pathname);
    if (!page && !asset) return new Response("Not available in this synthetic preview", { status: 404, headers });
    // Worker-first assets must be served explicitly after authentication.
    const response = asset && env.ASSETS ? await env.ASSETS.fetch(request) : await application(request);
    const resultHeaders = new Headers(response.headers);
    for (const [key, value] of headers) resultHeaders.set(key, value);
    resultHeaders.set("Content-Security-Policy", "connect-src 'self'; form-action 'self'; frame-src 'self'; base-uri 'self'");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: resultHeaders });
  };
}

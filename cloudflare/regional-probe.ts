type ProbeEnvironment = {
  PROBE_KEY: string;
  PREVIEW_ACCESS_KEY: string;
  QA_COOKIE: string;
  QA_REPORT_ID: string;
  QA_REPORT_TOKEN: string;
  PROBE_REGION: string;
};

/** Temporary private, read-only probe. Never returns cookies or report contents. */
const worker = {
  async fetch(request: Request, env: ProbeEnvironment) {
    if (request.headers.get("authorization") !== `Bearer ${env.PROBE_KEY}`) return new Response(null, { status: 404 });
    const url = new URL(request.url);
    const target = url.searchParams.get("target");
    const page = url.searchParams.get("page");
    if (!["netlify", "cloudflare"].includes(target ?? "") || !["dashboard", "editor", "report", "login"].includes(page ?? "")) {
      return new Response(null, { status: 400 });
    }
    const origin = target === "netlify" ? "https://staypack.app" : "https://staypack-app-preview.cameronmercer1991.workers.dev";
    const paths: Record<string, string> = {
      dashboard: "/dashboard",
      editor: `/short-term-rentals/appraisals/${env.QA_REPORT_ID}`,
      report: `/proposal/${env.QA_REPORT_TOKEN}`,
      login: "/login",
    };
    const headers = new Headers();
    if (page === "dashboard" || page === "editor") headers.set("cookie", env.QA_COOKIE);
    if (target === "cloudflare") headers.set("x-staypack-preview-key", env.PREVIEW_ACCESS_KEY);
    const start = Date.now();
    const response = await fetch(origin + paths[page!], { headers, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(45000) });
    const firstByteMs = Date.now() - start;
    const body = await response.text();
    return Response.json({
      region: env.PROBE_REGION, executionPlacement: request.headers.get("cf-placement"), target, page, status: response.status, firstByteMs,
      totalMs: Date.now() - start, bytes: body.length,
      fixturePresent: body.includes("12 Performance QA Esplanade"),
      resourceLimit: body.includes("1102") && body.includes("Worker"),
      cacheControl: response.headers.get("cache-control"),
      hosting: response.headers.get("x-staypack-hosting") || response.headers.get("x-staypack-delivery"),
      targetRay: response.headers.get("cf-ray"),
    }, { headers: { "Cache-Control": "private, no-store" } });
  },
};

export default worker;

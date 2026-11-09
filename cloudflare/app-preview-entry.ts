import application from "vinext/server/fetch-handler";
import { consumeAppraisalJobs, type QueueBatch } from "./appraisalConsumer";

type PreviewEnvironment = {
  PREVIEW_ACCESS_KEY: string;
  PREVIEW_AGENCY_ID: string;
  PUBLIC_REPORTS: { fetch(request: Request): Promise<Response> };
};
type PreviewContext = { waitUntil(promise: Promise<unknown>): void };

/** Private evaluation deployment. Never attach production routes to this Worker. */
const worker = {
  async queue(batch: QueueBatch, env: PreviewEnvironment) {
    if (!env.PREVIEW_AGENCY_ID) throw new Error("Preview job agency is not configured");
    await consumeAppraisalJobs(batch, env.PREVIEW_AGENCY_ID);
  },
  async fetch(request: Request, env: PreviewEnvironment, context: PreviewContext) {
    const url = new URL(request.url);
    // Print pages still require their signed, expiring print token and fresh
    // version/report checks. Browserless cannot carry the preview session cookie.
    const printRequest = request.method === "GET" && /^\/proposal\/print\/[a-f0-9-]+$/.test(url.pathname) && url.searchParams.has("token");
    const publicAsset = /^\/(?:fonts|brands|marketing)\//.test(url.pathname);
    const cookie = request.headers.get("cookie")?.split(";").map(value => value.trim())
      .find(value => value.startsWith("__Host-staypack-preview="))?.split("=")[1];
    if (!env.PREVIEW_ACCESS_KEY || (!printRequest && !publicAsset && cookie !== env.PREVIEW_ACCESS_KEY && request.headers.get("x-staypack-preview-key") !== env.PREVIEW_ACCESS_KEY)) {
      return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
    }
    const { pathname } = new URL(request.url);
    if (pathname === "/__preview/pdf" && request.method === "POST") {
      let stage = "input";
      try {
        const input = await request.json() as { token: string; versionId: string };
        const { publishedProposalAccess, cachedProposalSnapshot } = await import("../lib/digital-proposals/published");
        stage = "access";
        const version = await publishedProposalAccess(input.token, input.versionId);
        if (version.agency_id !== env.PREVIEW_AGENCY_ID) return new Response(null, { status: 404 });
        stage = "download";
        const { assetBucket } = await import("../lib/storage/bucket");
        const { createAdminClient } = await import("../lib/supabase/admin");
        const result = await assetBucket(createAdminClient(), "proposal-pdfs").download(version.pdf_path!);
        if (result.error || !result.data) throw new Error(result.error?.message ?? "Missing PDF");
        stage = "snapshot";
        await cachedProposalSnapshot(version.id, version.content_hash);
        return Response.json({ bytes: result.data.size }, { headers: { "Cache-Control": "no-store" } });
      } catch (error) {
        return Response.json({ stage, error: error instanceof Error ? error.message : "Failed" }, { status: 503 });
      }
    }
    if (pathname === "/__preview/runtime") {
      try {
        const { preserveProposalImages } = await import("../lib/digital-proposals/imageStorage");
        if (request.method === "POST" && env.PREVIEW_AGENCY_ID) {
          await preserveProposalImages({ heroImageUrl: "https://staypack.app/staypack-logo.png", logoUrl: "https://staypack.app/delivery/haven-properties/logo-on-dark.svg" }, env.PREVIEW_AGENCY_ID);
        }
        return Response.json({ imageModule: "loaded", storageCheck: request.method === "POST" }, { headers: { "Cache-Control": "private, no-store" } });
      } catch (error) {
        return Response.json({ imageModule: "failed", error: error instanceof Error ? error.message : "Unknown runtime error" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
      }
    }
    // Diagnostic runner only: exercises existing job code while the HTTP request
    // stays open. Production background delivery needs a durable queue consumer.
    if (pathname === "/__preview/job" && request.method === "POST") {
      const input = await request.json() as { kind?: string; jobId?: string };
      if (!["lease", "sales"].includes(input.kind ?? "") || !input.jobId || !env.PREVIEW_AGENCY_ID) return new Response(null, { status: 400 });
      const { createAdminClient } = await import("../lib/supabase/admin");
      const supabase = createAdminClient();
      const { data, error } = await supabase.from(`${input.kind}_appraisal_jobs`).select("agency_id").eq("id", input.jobId).maybeSingle();
      if (error || data?.agency_id !== env.PREVIEW_AGENCY_ID) return new Response(null, { status: 404 });
      try {
        const result = input.kind === "lease"
          ? await (await import("../lib/lease-appraisal/runLeaseAppraisalJob")).runLeaseAppraisalJob({ supabase, jobId: input.jobId })
          : await (await import("../lib/sales-appraisal/runSalesAppraisalJob")).runSalesAppraisalJob({ supabase, jobId: input.jobId });
        return Response.json({ status: result.status }, { headers: { "Cache-Control": "private, no-store" } });
      } catch (error) {
        return Response.json({ status: "failed", error: error instanceof Error ? error.message : "Job failed" }, { status: 422, headers: { "Cache-Control": "private, no-store" } });
      }
    }
    // No billing synchronization or customer deliveries from the evaluation copy.
    if (/^\/api\/(?:billing|delivery)(?:\/|$)/.test(pathname)) {
      return new Response("Disabled in hosting preview", { status: 409, headers: { "Cache-Control": "private, no-store" } });
    }
    if ((/^\/(?:examples|example|proposal)(?:\/|$)/.test(pathname) && !pathname.startsWith("/proposal/print/")) || pathname.startsWith("/_report-viewer/")) {
      return env.PUBLIC_REPORTS.fetch(request);
    }
    const response = await application.fetch(request, env, context);
    const headers = new Headers(response.headers);
    headers.set("X-StayPack-Hosting", "cloudflare-app-preview");
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};

export default worker;

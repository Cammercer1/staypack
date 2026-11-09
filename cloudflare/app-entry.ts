import application from "vinext/server/fetch-handler";
import { consumeAppraisalJobs, type QueueBatch } from "./appraisalConsumer";
import { scheduledMaintenance } from "./scheduled";

type Environment = {
  CANDIDATE_ACCESS_KEY?: string;
  SCHEDULES_ENABLED?: string;
  PUBLIC_REPORTS: { fetch(request: Request): Promise<Response> };
};
type Context = { waitUntil(promise: Promise<unknown>): void };

const worker = {
  async queue(batch: QueueBatch) { await consumeAppraisalJobs(batch); },
  async scheduled(event: { scheduledTime: number }, env: Environment) { await scheduledMaintenance(event, env); },
  async fetch(request: Request, env: Environment, context: Context) {
    const url = new URL(request.url);
    // The private candidate hostname is available only to deployment checks.
    if (url.hostname !== "staypack.app" && (!env.CANDIDATE_ACCESS_KEY || request.headers.get("x-staypack-candidate-key") !== env.CANDIDATE_ACCESS_KEY)) {
      return new Response("Not found", { status: 404, headers: { "Cache-Control": "private, no-store" } });
    }
    if ((/^\/(?:examples|example|proposal)(?:\/|$)/.test(url.pathname) && !url.pathname.startsWith("/proposal/print/")) || url.pathname.startsWith("/_report-viewer/")) {
      return env.PUBLIC_REPORTS.fetch(request);
    }
    const response = await application.fetch(request, env, context);
    const headers = new Headers(response.headers);
    headers.set("X-StayPack-Hosting", "cloudflare-app");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
export default worker;

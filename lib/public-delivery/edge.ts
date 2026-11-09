import { publicReportHandler, type ViewerAssets } from "./handler";
import { snapshotCache } from "./cache";

// Replaced with hashed public asset paths at build time, never environment credentials.
declare const PUBLIC_REPORT_ASSETS: ViewerAssets;
const timedFetch: typeof fetch = (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10000) });
const handler = publicReportHandler(PUBLIC_REPORT_ASSETS, snapshotCache(timedFetch));
export default async function deliverReport(request: Request, context?: { server?: { region?: string } }) {
  const response = await handler(request);
  if (context?.server?.region) response.headers.set("X-StayPack-Edge-Region", context.server.region);
  return response;
}

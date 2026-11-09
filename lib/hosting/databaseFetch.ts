import { snapshotCache } from "../public-delivery/cache";
import { workerDatabaseFetch } from "../public-delivery/worker";

// Workers does not accept Next's force-cache mode. Preserve the bounded cache
// for immutable content, while every live authorization read stays uncached.
const workerFetch = snapshotCache((input, init) => workerDatabaseFetch()(input, init));
export const hostingDatabaseFetch: typeof fetch = (input, init) => process.env.CLOUDFLARE_APP === "1"
  ? workerFetch(input, init) : fetch(input, init);

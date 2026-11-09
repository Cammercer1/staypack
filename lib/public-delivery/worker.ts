export type WorkerAssets = { ASSETS: { fetch: (request: Request) => Promise<Response> } };

/** The snapshot cache consumes Next's hints; Cloudflare network fetches must bypass its CDN. */
export function workerDatabaseFetch(fetcher: typeof fetch = fetch): typeof fetch {
  return (input, init) => {
    const options: RequestInit = { ...init, cache: "no-store", signal: AbortSignal.timeout(10000) };
    delete options.next;
    return fetcher(input, options);
  };
}

/** Only static assets bypass the reader. Report HTML always performs live authorization. */
export function workerRouter(deliver: (request: Request) => Promise<Response>, originFetch: typeof fetch = fetch) {
  return async (request: Request & { cf?: { colo?: string } }, env: WorkerAssets) => {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/proposal/print/")) {
      // A route subrequest reaches the existing Netlify origin, without invoking this Worker again.
      // A workers.dev preview must never proxy its own URL back into itself.
      return url.hostname === "staypack.app" ? originFetch(request) : new Response("Not found", { status: 404 });
    }
    if (/^\/(?:examples|example|proposal)(?:\/|$)/.test(url.pathname)) {
      const response = await deliver(request);
      response.headers.set("X-StayPack-Delivery", "cloudflare-edge");
      if (request.cf?.colo) response.headers.set("X-StayPack-Edge-Region", request.cf.colo);
      return response;
    }
    return env.ASSETS.fetch(request);
  };
}

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ProposalLoading } from "@/components/digital-proposals/ProposalLoading";
import { publishedProposal, ProposalError } from "@/lib/digital-proposals/published";
import { publishedProspectProposal, publishedProspectProposalBySlug } from "@/lib/prospects/published";
import { isProspectPublicSlug } from "@/lib/prospects/publicLinks";
import type { PublicReportPayload } from "./payload";

export type ViewerAssets = { script: string; styles: string[] };
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const json = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");

const criticalStyles = `html,body{margin:0;min-height:100%;font-family:Arial,sans-serif}[data-testid="proposal-loading"]{position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:32px;padding:32px;box-sizing:border-box}[data-testid="proposal-loading"]>div{display:flex;min-height:96px;align-items:center;justify-content:center}[data-testid="proposal-loading"] img{width:256px;max-width:65vw;height:auto;max-height:96px;object-fit:contain}[data-testid="proposal-loading"]>[aria-hidden]{width:20px;height:20px;box-sizing:border-box;border:2px solid currentColor;border-right-color:transparent;border-radius:50%}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(prefers-reduced-motion:no-preference){[data-testid="proposal-loading"]>[aria-hidden]{animation:report-spin 1s linear infinite}}@keyframes report-spin{to{transform:rotate(360deg)}}`;

/** HTML never enters a CDN cache. Only the shared reader's immutable snapshot is cacheable. */
export function publicReportHandler(assets: ViewerAssets, fetcher: typeof fetch = fetch) {
  return async (request: Request) => {
    const start = performance.now();
    const headers = new Headers({
      "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store, max-age=0",
      "Netlify-CDN-Cache-Control": "no-store", "CDN-Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow, noarchive", "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff", "X-StayPack-Delivery": "edge",
    });
    const respond = (body: string, status = 200) => {
      headers.set("Server-Timing", `report;dur=${(performance.now() - start).toFixed(1)}`);
      return new Response(request.method === "HEAD" ? null : body, { status, headers });
    };
    const unavailable = (status: number) => respond(`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Proposal unavailable</title><body style="font-family:Arial,sans-serif;padding:40px"><main><h1>${status === 404 ? "404 — Proposal not available" : "Proposal temporarily unavailable"}</h1><p>${status === 404 ? "This link is no longer available." : "Please try again shortly."}</p></main></body></html>`, status);
    if (request.method !== "GET" && request.method !== "HEAD") { headers.set("Allow", "GET, HEAD"); return respond("Method not allowed", 405); }
    const url = new URL(request.url);
    if (url.hostname === "staypack.netlify.app") {
      url.protocol = "https:"; url.host = "staypack.app";
      headers.set("Location", url.toString()); return respond("", 308);
    }
    const match = url.pathname.match(/^\/(?:examples\/([^/]+\/[^/]+)|example\/([a-f0-9]{64})|proposal\/([a-f0-9]{64}))\/?$/);
    if (!match || url.searchParams.getAll("page").length > 1 || url.searchParams.getAll("version").length > 1) return unavailable(404);
    const page = url.searchParams.get("page") ?? undefined;
    try {
      let payload: PublicReportPayload;
      if (match[3]) {
        const token = match[3];
        const version = await publishedProposal(token, url.searchParams.get("version") ?? undefined, fetcher);
        const query = `version=${encodeURIComponent(version.id)}`;
        const kind = version.snapshot.data.appraisal?.kind;
        payload = {
          snapshot: version.snapshot, publicPath: `/proposal/${token}?${query}`, initialPage: page,
          title: kind === "sales" ? "Sales appraisal proposal" : kind === "lease" ? "Rental appraisal proposal" : "Short-term rental proposal",
          tracking: { token, versionId: version.id },
          pdfHref: version.pdf_status === "ready" ? `/api/proposals/${token}/pdf?${query}` : undefined,
          attachments: version.snapshot.attachments.map(item => ({ ...item, href: `/api/proposals/${token}/attachments/${item.id}?${query}` })),
        };
      } else {
        const proposal = match[1] ? await publishedProspectProposalBySlug(match[1], fetcher) : await publishedProspectProposal(match[2], fetcher);
        if (!proposal) return unavailable(404);
        if (page && !proposal.snapshot.draft.pages.some(item => item.enabled && item.id === page)) return unavailable(404);
        if (match[2] && proposal.public_slug && isProspectPublicSlug(proposal.public_slug)) {
          headers.set("Location", `/examples/${proposal.public_slug}${page ? `?${new URLSearchParams({ page })}` : ""}`);
          return respond("", 307);
        }
        payload = { snapshot: proposal.snapshot, publicPath: match[1] ? `/examples/${match[1]}` : `/example/${match[2]}`,
          initialPage: page, exampleAgreement: true, attachments: [], title: `${proposal.snapshot.data.property.address} | ${proposal.snapshot.data.agency.name}` };
      }
      if (page && !payload.snapshot.draft.pages.some(item => item.enabled && item.id === page)) return unavailable(404);
      const { data, brand } = payload.snapshot;
      const loader = renderToStaticMarkup(createElement(ProposalLoading, { brand: { name: data.agency.name, logoUrl: data.agency.logoUrl, primary: brand.primary, primaryText: brand.primaryText } }));
      // The inline branded shell can paint while the larger viewer styles download.
      const styles = assets.styles.map(path => `<link rel="preload" as="style" href="${escape(path)}"><link rel="stylesheet" media="print" data-report-styles href="${escape(path)}">`).join("");
      const images = [data.agency.logoUrl, data.property.heroImageUrl].filter(Boolean).map(src => `<link rel="preload" as="image" href="${escape(src)}">`).join("");
      return respond(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="referrer" content="no-referrer"><title>${escape(payload.title)}</title><meta property="og:title" content="${escape(payload.title)}"><meta property="og:image" content="${escape(data.property.heroImageUrl)}"><style>${criticalStyles}</style>${images}${styles}<script type="module" src="${escape(assets.script)}"></script></head><body><div id="public-report-root">${loader}</div><script type="application/json" id="public-report-data">${json(payload)}</script><noscript><style>[data-testid="proposal-loading"]{display:none}</style><p>Please enable JavaScript to view this proposal.</p></noscript></body></html>`);
    } catch (error) {
      // No stale-on-error fallback, error details, private metadata or revoked snapshot in the response.
      return unavailable(error instanceof ProposalError && error.status === 404 ? 404 : 503);
    }
  };
}

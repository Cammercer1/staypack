import { cache, Suspense } from "react";
import { ProposalTracking } from "@/components/digital-proposals/ProposalTracking";
import { notFound } from "next/navigation";
import { PublicProposal } from "@/components/digital-proposals/PublicProposal";
import { ProposalLoading } from "@/components/digital-proposals/ProposalLoading";
import { publishedProposal, proposalLoadingBrand, ProposalError } from "@/lib/digital-proposals/published";

// Memoize only within this render; every request still checks live access.
const load = cache(async (token: string, versionId?: string) => publishedProposal(token, versionId).catch(error => {
  if (error instanceof ProposalError && error.status === 404) notFound();
  throw error;
}));
type PageProps = { params: Promise<{ token: string }>; searchParams: Promise<{ page?: string | string[]; version?: string | string[] }> };
export async function generateMetadata({ params, searchParams }: PageProps) {
  const requested = (await searchParams).version;
  if (Array.isArray(requested)) notFound();
  const version = await load((await params).token, requested);
  const kind = version.snapshot.data.appraisal?.kind;
  return { title: kind === "sales" ? "Sales appraisal proposal" : kind === "lease" ? "Rental appraisal proposal" : "Short-term rental proposal", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
}
export default async function ProposalPage(props: PageProps) {
  const { token } = await props.params;
  const requestedVersion = (await props.searchParams).version;
  if (Array.isArray(requestedVersion)) notFound();
  const brand = await proposalLoadingBrand(token, requestedVersion);
  return <Suspense fallback={<ProposalLoading brand={brand} />}><AuthorizedProposal {...props} /></Suspense>;
}
async function AuthorizedProposal({ params, searchParams }: PageProps) {
  const { token } = await params;
  const { page: requested, version: requestedVersion } = await searchParams;
  if (Array.isArray(requested) || Array.isArray(requestedVersion)) notFound();
  const version = await load(token, requestedVersion);
  const { data, draft, brand, attachments } = version.snapshot;
  if (requested && !draft.pages.some(page => page.enabled && page.id === requested)) notFound();
  const versionQuery = `version=${encodeURIComponent(version.id)}`;
  return <main className="min-h-dvh">
    <ProposalTracking key={version.id} token={token} versionId={version.id}><PublicProposal fullViewport data={data} draft={draft} brand={brand} initialPage={requested} publicPath={`/proposal/${token}?${versionQuery}`} pdfHref={version.pdf_status === "ready" ? `/api/proposals/${token}/pdf?${versionQuery}` : undefined}
      attachments={attachments.map(item => ({ ...item, href: `/api/proposals/${token}/attachments/${item.id}?${versionQuery}` }))} /></ProposalTracking>
  </main>;
}

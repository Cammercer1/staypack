import { ProposalTracking } from "@/components/digital-proposals/ProposalTracking";
import { notFound } from "next/navigation";
import { MultiPageProposal } from "@/components/digital-proposals/MultiPageProposal";
import { publishedProposal, ProposalError } from "@/lib/digital-proposals/published";

// The fresh access lookup makes this route dynamic; immutable data is cached separately.
export const metadata = { title: "Short-term rental proposal", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default async function ProposalPage({ params, searchParams }: {
  params: Promise<{ token: string }>; searchParams: Promise<{ page?: string }>;
}) {
  const { token } = await params;
  const version = await publishedProposal(token).catch(error => {
    if (error instanceof ProposalError && error.status === 404) notFound();
    throw error;
  });
  const { data, draft, brand, attachments } = version.snapshot;
  const requested = (await searchParams).page;
  if (requested && !draft.pages.some(page => page.enabled && page.id === requested)) notFound();
  return <main className="min-h-dvh">
    <ProposalTracking token={token}><MultiPageProposal fullViewport data={data} draft={draft} brand={brand} initialPage={requested} publicPath={`/proposal/${token}`} pdfHref={version.pdf_status === "ready" ? `/api/proposals/${token}/pdf` : undefined}
      attachments={attachments.map(item => ({ ...item, href: `/api/proposals/${token}/attachments/${item.id}` }))} /></ProposalTracking>
  </main>;
}

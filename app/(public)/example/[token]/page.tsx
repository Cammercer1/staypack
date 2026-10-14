import { notFound, redirect } from "next/navigation";
import { MultiPageProposal } from "@/components/digital-proposals/MultiPageProposal";
import { publishedProspectProposal } from "@/lib/prospects/server";
import { prospectPublicPath } from "@/lib/prospects/publicLinks";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "Property management proposal" }, robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function ExampleProposalPage({ params, searchParams }: {
  params: Promise<{ token: string }>; searchParams: Promise<{ page?: string }>;
}) {
  const { token } = await params;
  const proposal = await publishedProspectProposal(token);
  if (!proposal) notFound();
  const page = (await searchParams).page;
  const { data, draft, brand } = proposal.snapshot;
  if (page && !draft.pages.some(item => item.enabled && item.id === page)) notFound();
  const publicPath = prospectPublicPath(proposal);
  if (publicPath) redirect(`${publicPath}${page ? `?${new URLSearchParams({ page })}` : ""}`);
  return <main><MultiPageProposal fullViewport exampleAgreement data={data} draft={draft} brand={brand}
    initialPage={page} publicPath={`/example/${token}`} /></main>;
}

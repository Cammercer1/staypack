import { notFound } from "next/navigation";
import { MultiPageProposal } from "@/components/digital-proposals/MultiPageProposal";
import { publishedProspectProposalBySlug } from "@/lib/prospects/server";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "Property management proposal" }, robots: { index: false, follow: false }, referrer: "no-referrer" as const };

export default async function ExampleProposalPage({ params, searchParams }: {
  params: Promise<{ company: string; property: string }>; searchParams: Promise<{ page?: string }>;
}) {
  const { company, property } = await params;
  const slug = `${company}/${property}`;
  const proposal = await publishedProspectProposalBySlug(slug);
  if (!proposal) notFound();
  const page = (await searchParams).page;
  const { data, draft, brand } = proposal.snapshot;
  if (page && !draft.pages.some(item => item.enabled && item.id === page)) notFound();
  return <main><MultiPageProposal fullViewport exampleAgreement data={data} draft={draft} brand={brand}
    initialPage={page} publicPath={`/examples/${slug}`} /></main>;
}

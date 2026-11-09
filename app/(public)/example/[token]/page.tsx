import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { PublicProposal } from "@/components/digital-proposals/PublicProposal";
import { ProposalLoading } from "@/components/digital-proposals/ProposalLoading";
import { publishedProspectProposal, prospectLoadingBrand } from "@/lib/prospects/published";
import { prospectPublicPath } from "@/lib/prospects/publicLinks";

export const revalidate = 0;
export const metadata = { title: { absolute: "Property management proposal" }, robots: { index: false, follow: false }, referrer: "no-referrer" as const };

type PageProps = {
  params: Promise<{ token: string }>; searchParams: Promise<{ page?: string }>;
};
export default async function ExampleProposalPage(props: PageProps) {
  const { token } = await props.params;
  const brand = await prospectLoadingBrand("public_token", token);
  return <Suspense fallback={<ProposalLoading brand={brand} />}><AuthorizedExample {...props} /></Suspense>;
}
async function AuthorizedExample({ params, searchParams }: PageProps) {
  const { token } = await params;
  const proposal = await publishedProspectProposal(token);
  if (!proposal) notFound();
  const page = (await searchParams).page;
  const { data, draft, brand } = proposal.snapshot;
  if (page && !draft.pages.some(item => item.enabled && item.id === page)) notFound();
  const publicPath = prospectPublicPath(proposal);
  if (publicPath) redirect(`${publicPath}${page ? `?${new URLSearchParams({ page })}` : ""}`);
  return <main><PublicProposal fullViewport exampleAgreement data={data} draft={draft} brand={brand}
    initialPage={page} publicPath={`/example/${token}`} /></main>;
}

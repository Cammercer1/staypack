import { cache, Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicProposal } from "@/components/digital-proposals/PublicProposal";
import { ProposalLoading } from "@/components/digital-proposals/ProposalLoading";
import { publishedProspectProposalBySlug, prospectLoadingBrand } from "@/lib/prospects/published";

// Dynamic HTML + fresh authorization, but allow explicit internal content/branding caches.
export const revalidate = 0;
const getProposal = cache(publishedProspectProposalBySlug);

type ExampleParams = { company: string; property: string };

export async function generateMetadata({ params }: { params: Promise<ExampleParams> }): Promise<Metadata> {
  const { company, property } = await params;
  const slug = `${company}/${property}`;
  const proposal = await getProposal(slug);
  if (!proposal) notFound();
  const { data } = proposal.snapshot;
  const title = `${data.property.address} | ${data.agency.name}`;
  const description = `Explore the estimated rental potential of ${data.property.address}, ${data.property.suburb}, with ${data.agency.name}. Compare long-term and short-term rental options and our management service.`;
  const images = [{ url: data.property.heroImageUrl, alt: data.property.address }];
  return {
    title: { absolute: title }, description,
    robots: { index: false, follow: false }, referrer: "no-referrer",
    openGraph: { title, description, type: "website", url: `https://staypack.app/examples/${slug}`, images },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

type PageProps = {
  params: Promise<ExampleParams>; searchParams: Promise<{ page?: string }>;
};

export default async function ExampleProposalPage(props: PageProps) {
  const { company, property } = await props.params;
  const brand = await prospectLoadingBrand("public_slug", `${company}/${property}`);
  return <Suspense fallback={<ProposalLoading brand={brand} />}><AuthorizedExample {...props} /></Suspense>;
}

async function AuthorizedExample({ params, searchParams }: PageProps) {
  const { company, property } = await params;
  const slug = `${company}/${property}`;
  const proposal = await getProposal(slug);
  if (!proposal) notFound();
  const page = (await searchParams).page;
  const { data, draft, brand } = proposal.snapshot;
  if (page && !draft.pages.some(item => item.enabled && item.id === page)) notFound();
  return <main><PublicProposal fullViewport exampleAgreement data={data} draft={draft} brand={brand}
    initialPage={page} publicPath={`/examples/${slug}`} /></main>;
}

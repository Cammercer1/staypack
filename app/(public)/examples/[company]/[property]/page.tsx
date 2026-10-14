import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MultiPageProposal } from "@/components/digital-proposals/MultiPageProposal";
import { publishedProspectProposalBySlug } from "@/lib/prospects/server";

export const dynamic = "force-dynamic";
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

export default async function ExampleProposalPage({ params, searchParams }: {
  params: Promise<ExampleParams>; searchParams: Promise<{ page?: string }>;
}) {
  const { company, property } = await params;
  const slug = `${company}/${property}`;
  const proposal = await getProposal(slug);
  if (!proposal) notFound();
  const page = (await searchParams).page;
  const { data, draft, brand } = proposal.snapshot;
  if (page && !draft.pages.some(item => item.enabled && item.id === page)) notFound();
  return <main><MultiPageProposal fullViewport exampleAgreement data={data} draft={draft} brand={brand}
    initialPage={page} publicPath={`/examples/${slug}`} /></main>;
}

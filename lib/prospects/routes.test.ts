import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import SlugPage, { generateMetadata } from "@/app/(public)/examples/[company]/[property]/page";
import TokenPage, { metadata as tokenMetadata } from "@/app/(public)/example/[token]/page";
import { publishedProspectProposal, publishedProspectProposalBySlug } from "./published";
import { createProposalFixture } from "@/lib/digital-proposals/fixtures";
import { DEFAULT_PROPOSAL_DRAFT } from "@/lib/digital-proposals/template";
import { BRAND_DEFAULTS } from "@/lib/digital-proposals/brand";
import nextConfig from "@/next.config";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

vi.mock("./published", () => ({ publishedProspectProposal: vi.fn(), publishedProspectProposalBySlug: vi.fn(), prospectLoadingBrand: vi.fn().mockResolvedValue({ name: "Example agency", logoUrl: "https://example.com/logo.png", primary: "#123456", primaryText: "#ffffff" }) }));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("404"); },
  redirect: (url: string) => { throw new Error(`redirect:${url}`); },
}));
vi.mock("@/components/digital-proposals/PublicProposal", () => ({
  PublicProposal: ({ data, publicPath, initialPage }: { data: { property: { address: string } }; publicPath: string; initialPage?: string }) =>
    createElement("article", { "data-path": publicPath, "data-page": initialPage }, data.property.address),
}));

const token = "a".repeat(64);
const snapshot = { version: 1 as const, data: createProposalFixture(), draft: DEFAULT_PROPOSAL_DRAFT, brand: BRAND_DEFAULTS, attachments: [] };
beforeEach(() => vi.clearAllMocks());

// Resolve the async server component behind the streaming boundary for unit assertions.
async function authorize(shell: Awaited<ReturnType<typeof SlugPage>>) {
  const content = shell.props.children;
  return content.type(content.props);
}

it("streams only the client's logo and primary colour before report authorization resolves", async () => {
  const shell = await SlugPage({ params: Promise.resolve({ company: "company", property: "property" }), searchParams: Promise.resolve({}) });
  const html = renderToStaticMarkup(shell.props.fallback);
  expect(html).toContain("Example agency");
  expect(html).toContain("#123456");
  expect(html).not.toContain("StayPack");
  expect(html).not.toContain(snapshot.data.property.address);
  expect(publishedProspectProposalBySlug).not.toHaveBeenCalled();
});

it.each([
  ["aus-vision-realty", "57-garling-street-kardinya"],
  ["property-providers", "6-33-malvern-avenue-manly"],
])("serves the frozen proposal at /examples/%s/%s", async (company, property) => {
  const slug = `${company}/${property}`;
  vi.mocked(publishedProspectProposalBySlug).mockResolvedValue({ id: "example", public_slug: slug, snapshot });
  const html = renderToStaticMarkup(await authorize(await SlugPage({ params: Promise.resolve({ company, property }), searchParams: Promise.resolve({ page: "forecast" }) })));
  expect(publishedProspectProposalBySlug).toHaveBeenCalledWith(slug);
  expect(html).toContain(snapshot.data.property.address);
  expect(html).toContain(`data-path="/examples/${slug}"`);
  expect(html).toContain('data-page="forecast"');
});

it("keeps legacy links working and preserves the selected page", async () => {
  const slug = "aus-vision-realty/57-garling-street-kardinya";
  vi.mocked(publishedProspectProposal).mockResolvedValue({ id: "example", public_slug: slug, snapshot });
  await expect(authorize(await TokenPage({ params: Promise.resolve({ token }), searchParams: Promise.resolve({ page: "forecast" }) })))
    .rejects.toThrow(`redirect:/examples/${slug}?page=forecast`);
});

it("rejects unavailable examples and unknown proposal pages", async () => {
  const params = Promise.resolve({ company: "company", property: "property" });
  vi.mocked(publishedProspectProposalBySlug).mockResolvedValue(null);
  await expect(authorize(await SlugPage({ params, searchParams: Promise.resolve({}) }))).rejects.toThrow("404");
  vi.mocked(publishedProspectProposalBySlug).mockResolvedValue({ id: "example", public_slug: "company/property", snapshot });
  await expect(authorize(await SlugPage({ params, searchParams: Promise.resolve({ page: "private" }) }))).rejects.toThrow("404");
});

it("excludes both public URL formats from indexing and caching", async () => {
  vi.mocked(publishedProspectProposalBySlug).mockResolvedValue({ id: "example", public_slug: "company/property", snapshot });
  const slugMetadata = await generateMetadata({ params: Promise.resolve({ company: "company", property: "property" }) });
  for (const metadata of [slugMetadata, tokenMetadata]) expect(metadata.robots).toEqual({ index: false, follow: false });
  const rules = await nextConfig(PHASE_PRODUCTION_BUILD).headers!();
  for (const path of ["/example/:path*", "/examples/:path*"]) {
    const headers = rules.find(rule => rule.source === path)?.headers;
    expect(headers).toEqual(expect.arrayContaining([
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
    ]));
  }
});

it("uses the published property's branding and photo in shared link previews", async () => {
  const slug = "aus-vision-realty/57-garling-street-kardinya";
  vi.mocked(publishedProspectProposalBySlug).mockResolvedValue({ id: "example", public_slug: slug, snapshot });
  const metadata = await generateMetadata({ params: Promise.resolve({ company: "aus-vision-realty", property: "57-garling-street-kardinya" }) });
  expect(metadata.title).toEqual({ absolute: `${snapshot.data.property.address} | ${snapshot.data.agency.name}` });
  expect(metadata.openGraph).toMatchObject({ url: `https://staypack.app/examples/${slug}`, images: [{ url: snapshot.data.property.heroImageUrl }] });
  expect(metadata.twitter).toMatchObject({ card: "summary_large_image", images: [{ url: snapshot.data.property.heroImageUrl }] });
});

it("does not expose preview metadata for unavailable examples", async () => {
  vi.mocked(publishedProspectProposalBySlug).mockResolvedValue(null);
  await expect(generateMetadata({ params: Promise.resolve({ company: "company", property: "property" }) })).rejects.toThrow("404");
});

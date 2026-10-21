import { renderToStaticMarkup } from "react-dom/server";
import { createElement, type ReactNode } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { createProposalFixture } from "@/lib/digital-proposals/fixtures";
import { DEFAULT_PROPOSAL_DRAFT } from "@/lib/digital-proposals/template";
import { BRAND_DEFAULTS } from "@/lib/digital-proposals/brand";
import ProposalPage, { generateMetadata } from "./page";

const mocks = vi.hoisted(() => ({ published: vi.fn(), tracking: vi.fn(), proposal: vi.fn() }));
vi.mock("@/lib/digital-proposals/published", () => ({ publishedProposal: mocks.published, ProposalError: class extends Error { constructor(message: string, public status: number) { super(message); } } }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("not found"); } }));
vi.mock("@/components/digital-proposals/ProposalTracking", () => ({ ProposalTracking: (props: { children: ReactNode }) => { mocks.tracking(props); return props.children; } }));
vi.mock("@/components/digital-proposals/MultiPageProposal", () => ({ MultiPageProposal: (props: unknown) => { mocks.proposal(props); return createElement("div", null, "Proposal"); } }));

const token = "a".repeat(64);
const versionId = "00000000-0000-4000-8000-000000000001";
const documentId = "00000000-0000-4000-8000-000000000002";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.published.mockResolvedValue({ id: versionId, pdf_status: "ready", snapshot: {
    data: createProposalFixture(), draft: structuredClone(DEFAULT_PROPOSAL_DRAFT), brand: BRAND_DEFAULTS,
    attachments: [{ id: documentId, name: "Guide.pdf", byte_size: 100 }],
  } });
});

it("opens the latest stable link and pins all subsequent requests to the resolved version", async () => {
  renderToStaticMarkup(await ProposalPage({ params: Promise.resolve({ token }), searchParams: Promise.resolve({}) }));
  expect(mocks.published).toHaveBeenCalledWith(token, undefined);
  expect(mocks.tracking).toHaveBeenCalledWith(expect.objectContaining({ token, versionId }));
  expect(mocks.proposal).toHaveBeenCalledWith(expect.objectContaining({
    publicPath: `/proposal/${token}?version=${versionId}`,
    pdfHref: `/api/proposals/${token}/pdf?version=${versionId}`,
    attachments: [expect.objectContaining({ id: documentId, href: `/api/proposals/${token}/attachments/${documentId}?version=${versionId}` })],
  }));
});

it("uses an explicitly requested snapshot for both metadata and the displayed page", async () => {
  const props = { params: Promise.resolve({ token }), searchParams: Promise.resolve({ version: versionId, page: "evidence" }) };
  await generateMetadata(props);
  renderToStaticMarkup(await ProposalPage(props));
  expect(mocks.published.mock.calls.every(call => call[0] === token && call[1] === versionId)).toBe(true);
  expect(mocks.proposal).toHaveBeenCalledWith(expect.objectContaining({ initialPage: "evidence" }));
});

it("rejects ambiguous version queries without resolving a different snapshot", async () => {
  const props = { params: Promise.resolve({ token }), searchParams: Promise.resolve({ version: [versionId, documentId] }) };
  await expect(ProposalPage(props)).rejects.toThrow("not found");
  await expect(generateMetadata(props)).rejects.toThrow("not found");
  expect(mocks.published).not.toHaveBeenCalled();
});

import { beforeEach, expect, it, vi } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { createProposalFixture } from "./fixtures";
import { DEFAULT_PROPOSAL_DRAFT, type ProposalDraft } from "./template";
import { loadProposalWorkspace, publishProposal, saveProposal } from "./server";
import { buildProposalPdfReport } from "./pdfReport";
import type { ProposalSnapshot } from "./workspace";

const mocks = vi.hoisted(() => ({ preserve: vi.fn(), rpc: vi.fn() }));
vi.mock("./imageStorage", () => ({ preserveProposalImages: mocks.preserve }));
vi.mock("../supabase/admin", () => ({ createAdminClient: () => ({ rpc: mocks.rpc }) }));
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const cover = "https://property.test/new-cover.jpg";
const gallery = "https://property.test/gallery.jpg";
const selection = { heroImageUrl: cover, gallery: [gallery, cover] };

function setup(initialDraft: ProposalDraft = structuredClone(DEFAULT_PROPOSAL_DRAFT)) {
  let stored = { draft_json: initialDraft, revision: 1 };
  const fixture = createLintRegressionFixtures();
  const from = (table: string) => {
    const result = { data: table === "digital_proposal_drafts" ? stored : [], error: null };
    const builder = { select: () => builder, eq: () => builder, order: () => builder,
      limit: () => Promise.resolve(result), maybeSingle: () => Promise.resolve(result),
      then: (resolve: (result: unknown) => unknown) => Promise.resolve(result).then(resolve) };
    return builder;
  };
  mocks.rpc.mockImplementation(async (name: string, args: { p_draft?: ProposalDraft }) => {
    if (name === "save_digital_proposal") {
      stored = { draft_json: structuredClone(args.p_draft!), revision: stored.revision + 1 };
      return { data: stored, error: null };
    }
    return { data: { id, share_token: "a".repeat(64), share_link: { id, token: "a".repeat(64), version_id: id, draft_revision: 1, source_fingerprint: "source", created_at: "2026-10-21T00:00:00Z", updated_at: "2026-10-21T00:00:00Z", revoked_at: null } }, error: null };
  });
  return { agency: { id }, report: fixture.report, listing: fixture.listing,
    appraisal: { kind: "str", updated_at: "2026-10-21T00:00:00Z" }, supabase: { from },
    data: createProposalFixture(), availablePhotos: [cover, gallery], availableAgents: [],
    pdfReport: buildProposalPdfReport({ ...fixture.report.final_report_json!, template_id: "haven-properties-str" }),
    assignment: { name: "Test", version: 1, defaults: structuredClone(DEFAULT_PROPOSAL_DRAFT) }, sourceFingerprint: "source",
  } as unknown as Parameters<typeof saveProposal>[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.preserve.mockImplementation(async (snapshot: ProposalSnapshot) => snapshot);
});

it("saves and reloads proposal photos, then freezes matching web and PDF images without changing the property master", async () => {
  const context = setup();
  const before = structuredClone({ listing: context.listing, data: context.data, pdfReport: context.pdfReport });
  const draft = { ...DEFAULT_PROPOSAL_DRAFT, propertyImages: selection };
  const saved = await saveProposal(context, draft, 1);
  expect(saved.draft.propertyImages).toEqual(selection);
  const workspace = await loadProposalWorkspace(context);
  expect(workspace.draft?.propertyImages).toEqual(selection);
  expect(workspace.availablePhotos).toEqual([cover, gallery]);
  await publishProposal(context, saved.revision, "source");
  const snapshot = mocks.preserve.mock.calls[0][0] as ProposalSnapshot;
  expect(snapshot.data.property).toMatchObject(selection);
  expect(snapshot.pdfReport?.property).toMatchObject({ hero_image_url: cover, selected_image_urls: selection.gallery });
  expect(snapshot.draft.propertyImages).toEqual(selection);
  expect({ listing: context.listing, data: context.data, pdfReport: context.pdfReport }).toEqual(before);
  expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual(["save_digital_proposal", "publish_digital_proposal_v3"]);
});

it.each([false, true])("rejects photos outside the property pool before saving (studio=%s)", async studio => {
  const context = setup();
  const foreign = "https://another-property.test/photo.jpg";
  await expect(saveProposal(context, { ...DEFAULT_PROPOSAL_DRAFT, propertyImages: { heroImageUrl: foreign, gallery: [foreign] } }, 1, studio))
    .rejects.toThrow("Choose photos from this property’s library");
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("rejects repeated photo choices before saving a new draft", async () => {
  const context = setup();
  await expect(saveProposal(context, { ...DEFAULT_PROPOSAL_DRAFT, propertyImages: { heroImageUrl: cover, gallery: [cover, cover] } }, 1))
    .rejects.toThrow("Include each property photo once");
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("rechecks photo availability before publication without altering any existing version", async () => {
  const context = setup({ ...DEFAULT_PROPOSAL_DRAFT, propertyImages: selection });
  context.availablePhotos = [gallery];
  await expect(publishProposal(context, 1, "source")).rejects.toThrow("selected property photo is no longer available");
  expect(mocks.preserve).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it("keeps the existing web and PDF images when a legacy draft has no photo override", async () => {
  const context = setup();
  await publishProposal(context, 1, "source");
  const snapshot = mocks.preserve.mock.calls[0][0] as ProposalSnapshot;
  expect(snapshot.data.property).toEqual(context.data.property);
  expect(snapshot.pdfReport?.property).toEqual(context.pdfReport?.property);
  expect(snapshot.draft).not.toHaveProperty("propertyImages");
});

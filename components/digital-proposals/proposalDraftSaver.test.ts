import { expect, it, vi } from "vitest";
import { createProposalFixture } from "@/lib/digital-proposals/fixtures";
import { DEFAULT_PROPOSAL_DRAFT, type ProposalDraft } from "@/lib/digital-proposals/template";
import { createProposalDraftSaver, mergeSavedProposalDraft, type SavedProposalDraft } from "./proposalDraftSaver";

function setup(request: (draft: ProposalDraft, revision: number) => Promise<SavedProposalDraft>, recover?: () => Promise<SavedProposalDraft | null>) {
  let draft = structuredClone(DEFAULT_PROPOSAL_DRAFT);
  const onError = vi.fn(), onSaving = vi.fn();
  const onSaved = vi.fn((saved: SavedProposalDraft, submitted: ProposalDraft) => {
    draft = mergeSavedProposalDraft(submitted, draft, saved.draft);
  });
  const saver = createProposalDraftSaver({ readDraft: () => draft, request, recover, onSaved, onError, onSaving });
  saver.setSource({ data: createProposalFixture(), draft: structuredClone(draft), revision: 6 });
  return { saver, onError, onSaving, onSaved, get draft() { return draft; }, change(patch: Partial<ProposalDraft>) { draft = { ...draft, ...patch }; } };
}

it("serializes background and concurrent flushes, retaining edits made during the first request", async () => {
  let first!: (saved: SavedProposalDraft) => void, second!: (saved: SavedProposalDraft) => void;
  const request = vi.fn<(draft: ProposalDraft, revision: number) => Promise<SavedProposalDraft>>()
    .mockImplementationOnce(() => new Promise(resolve => { first = resolve; }))
    .mockImplementationOnce(() => new Promise(resolve => { second = resolve; }));
  const state = setup(request);
  state.change({ motion: false });
  const background = state.saver.saveOnce();
  const firstDraft = structuredClone(request.mock.calls[0][0]);
  state.change({ heroLayout: "split" });
  const navigation = state.saver.flush(), publishing = state.saver.flush();
  expect(request).toHaveBeenCalledTimes(1);
  first({ draft: firstDraft, revision: 7 });
  await background;
  await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
  expect(state.draft.heroLayout).toBe("split");
  expect(request.mock.calls[1]).toEqual([expect.objectContaining({ motion: false, heroLayout: "split" }), 7]);
  second({ draft: request.mock.calls[1][0], revision: 8 });
  expect(await navigation).toBe(8);
  expect(await publishing).toBe(8);
  expect(request).toHaveBeenCalledTimes(2);
});

it("applies an explicit photo selection while retaining newer form fields", async () => {
  let finish!: (saved: SavedProposalDraft) => void;
  const request = vi.fn<(draft: ProposalDraft, revision: number) => Promise<SavedProposalDraft>>().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const state = setup(request);
  const photos = { heroImageUrl: "https://example.com/cover.jpg", gallery: ["https://example.com/cover.jpg"] };
  const save = state.saver.saveOnce(current => ({ ...current, propertyImages: photos }));
  state.change({ pages: state.draft.pages.map(page => ({ ...page, enabled: page.id === "forecast" ? false : page.enabled })) });
  finish({ draft: request.mock.calls[0][0], revision: 7 });
  await save;
  expect(state.draft.propertyImages).toEqual(photos);
  expect(state.draft.pages.find(page => page.id === "forecast")?.enabled).toBe(false);
});

it("applies a queued photo change to the latest draft after the earlier save finishes", async () => {
  let first!: (saved: SavedProposalDraft) => void;
  const request = vi.fn<(draft: ProposalDraft, revision: number) => Promise<SavedProposalDraft>>()
    .mockImplementationOnce(() => new Promise(resolve => { first = resolve; }))
    .mockImplementationOnce(async (draft, revision) => ({ draft, revision: revision + 1 }));
  const state = setup(request);
  state.change({ motion: false });
  const background = state.saver.saveOnce();
  const photos = { heroImageUrl: "https://example.com/cover.jpg", gallery: ["https://example.com/cover.jpg"] };
  const photoSave = state.saver.flush(current => ({ ...current, propertyImages: photos }));
  state.change({ heroLayout: "split" });
  first({ draft: request.mock.calls[0][0], revision: 7 });
  await background;
  expect(await photoSave).toBe(8);
  expect(request.mock.calls[1]).toEqual([expect.objectContaining({ motion: false, heroLayout: "split", propertyImages: photos }), 7]);
  expect(state.draft).toMatchObject({ heroLayout: "split", propertyImages: photos });
});

it("fails all waiting flushes without retrying or advancing a conflicting revision", async () => {
  let fail!: (error: Error) => void;
  const request = vi.fn<(draft: ProposalDraft, revision: number) => Promise<SavedProposalDraft>>()
    .mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }))
    .mockImplementationOnce(async (draft, revision) => ({ draft, revision: revision + 1 }));
  const recover = vi.fn().mockResolvedValue({ draft: { ...structuredClone(DEFAULT_PROPOSAL_DRAFT), heroLayout: "split" }, revision: 9 });
  const state = setup(request, recover);
  state.change({ motion: false });
  const background = state.saver.saveOnce(), navigation = state.saver.flush();
  fail(new Error("Another tab saved this proposal. Reload before saving."));
  expect(await background).toBeNull();
  expect(await navigation).toBeNull();
  expect(request).toHaveBeenCalledTimes(1);
  expect(recover).toHaveBeenCalledTimes(1);
  expect(state.draft.motion).toBe(false);
  expect(state.onError).toHaveBeenLastCalledWith("Another tab saved this proposal. Reload before saving.");
  expect(await state.saver.flush()).toBe(7);
  expect(request.mock.calls[1][1]).toBe(6);
});

it("recovers a lost acknowledgement only from the exact submitted snapshot and retains newer edits", async () => {
  let fail!: (error: Error) => void;
  const request = vi.fn<(draft: ProposalDraft, revision: number) => Promise<SavedProposalDraft>>()
    .mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }))
    .mockImplementationOnce(async (draft, revision) => ({ draft, revision: revision + 1 }));
  const recover = vi.fn(async () => ({ draft: request.mock.calls[0][0], revision: 7 }));
  const state = setup(request, recover);
  state.change({ motion: false });
  const background = state.saver.saveOnce();
  state.change({ heroLayout: "split" });
  fail(new Error("Network connection lost."));
  expect(await background).toBe(7);
  expect(recover).toHaveBeenCalledOnce();
  expect(state.draft).toMatchObject({ motion: false, heroLayout: "split" });
  expect(state.onError).toHaveBeenLastCalledWith("");
  expect(await state.saver.flush()).toBe(8);
  expect(request.mock.calls[1]).toEqual([expect.objectContaining({ motion: false, heroLayout: "split" }), 7]);
});

it("creates an initial saved revision when an untouched proposal has no draft yet", async () => {
  const request = vi.fn(async (draft: ProposalDraft, revision: number) => ({ draft, revision: revision + 1 }));
  const state = setup(request);
  state.saver.setSource({ data: createProposalFixture(), draft: null, revision: 0 });
  expect(await state.saver.flush()).toBe(1);
  expect(request).toHaveBeenCalledOnce();
  expect(request.mock.calls[0][1]).toBe(0);
});

it("normalizes an unchanged draft without a redundant write or endless flush", async () => {
  const request = vi.fn();
  const state = setup(request);
  state.change({ content: { ...state.draft.content, title: `  ${state.draft.content.title}  ` } });
  expect(await state.saver.flush()).toBe(6);
  expect(state.draft.content.title).toBe(DEFAULT_PROPOSAL_DRAFT.content.title);
  expect(request).not.toHaveBeenCalled();
});

it("blocks new saves during source refresh and ignores responses after disposal", async () => {
  let finish!: (saved: SavedProposalDraft) => void;
  const request = vi.fn<(draft: ProposalDraft, revision: number) => Promise<SavedProposalDraft>>().mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const state = setup(request);
  state.change({ motion: false });
  const active = state.saver.saveOnce();
  state.saver.setSource(null);
  const navigation = state.saver.flush();
  state.saver.dispose();
  finish({ draft: request.mock.calls[0][0], revision: 7 });
  expect(await active).toBeNull();
  expect(await navigation).toBeNull();
  expect(state.onSaved).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledTimes(1);
});

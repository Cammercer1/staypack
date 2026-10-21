import { validateProposalDraft, type ProposalDraft } from "@/lib/digital-proposals/template";
import type { ProposalData } from "@/lib/digital-proposals/data";

export const PROPOSAL_AUTOSAVE_DELAY = 750;
export type SavedProposalDraft = { draft: ProposalDraft; revision: number };
type SaveSource = { data: ProposalData; draft: ProposalDraft | null; revision: number };

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

/** Preserve fields changed after submission, including array edits and removals. */
export function mergeSavedProposalDraft(submitted: ProposalDraft, current: ProposalDraft, saved: ProposalDraft): ProposalDraft {
  return Object.fromEntries([...new Set([...Object.keys(saved), ...Object.keys(current)])].map(key => {
    const field = key as keyof ProposalDraft;
    return [field, same(submitted[field], current[field]) ? saved[field] : current[field]];
  })) as ProposalDraft;
}

/** One revision owner for background saving, navigation, publishing and photo commits. */
export function createProposalDraftSaver({ readDraft, request, recover, onSaved, onSaving, onError }: {
  readDraft: () => ProposalDraft;
  request: (draft: ProposalDraft, revision: number) => Promise<SavedProposalDraft>;
  recover?: () => Promise<SavedProposalDraft | null>;
  onSaved: (saved: SavedProposalDraft, submitted: ProposalDraft) => void;
  onSaving: (saving: boolean) => void;
  onError: (error: string) => void;
}) {
  let source: SaveSource | null = null;
  let pending: Promise<number | null> | null = null;
  let disposed = false;

  async function saveOnce(updateDraft?: (current: ProposalDraft) => ProposalDraft): Promise<number | null> {
    // Recheck after each await: another caller may have started the next write.
    while (pending) if (await pending === null) return null;
    if (!source || disposed) return null;
    const context = source;
    const submitted = structuredClone(readDraft());
    const validation = validateProposalDraft(updateDraft ? updateDraft(submitted) : submitted, context.data);
    if (!validation.draft) { onError(validation.errors.join(" ")); return null; }
    const requested = validation.draft;
    onError("");
    if (context.draft && same(requested, context.draft)) {
      if (!same(submitted, context.draft)) onSaved({ draft: context.draft, revision: context.revision }, submitted);
      return context.revision;
    }
    onSaving(true);
    const accept = (saved: SavedProposalDraft) => {
      if (disposed) return null;
      context.draft = saved.draft;
      context.revision = saved.revision;
      onSaved(saved, submitted);
      return saved.revision;
    };
    const operation = (async () => {
      try {
        return accept(await request(requested, context.revision));
      } catch (error) {
        // A response can be lost after a successful write. Adopt only that exact
        // snapshot; a competing draft must retain its revision conflict.
        if (!disposed && recover) {
          try {
            const saved = await recover();
            if (saved && saved.revision > context.revision && same(saved.draft, requested)) return accept(saved);
          } catch { /* Keep the original save error if recovery cannot be read. */ }
        }
        if (!disposed) onError(error instanceof Error ? error.message : "Unable to save. Please try again.");
        return null;
      } finally {
        if (!disposed) onSaving(false);
      }
    })();
    pending = operation;
    try { return await operation; }
    finally { if (pending === operation) pending = null; }
  }

  return {
    get pending() { return pending; },
    setSource(value: SaveSource | null) { source = value; if (value) disposed = false; },
    dispose() { disposed = true; source = null; },
    saveOnce,
    async flush(updateDraft?: (current: ProposalDraft) => ProposalDraft): Promise<number | null> {
      let next = updateDraft;
      while (!disposed) {
        const revision = await saveOnce(next);
        if (revision === null || !source) return null;
        next = undefined;
        if (same(readDraft(), source.draft)) return revision;
      }
      return null;
    },
  };
}

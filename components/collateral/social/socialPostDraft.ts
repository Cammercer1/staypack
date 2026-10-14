import type { SocialPostsDocumentJson } from "@/lib/collateral/templates/types";

export type SocialPostDocumentUpdate =
  | SocialPostsDocumentJson
  | ((document: SocialPostsDocumentJson) => SocialPostsDocumentJson);

export type SocialPostDraft = {
  document: SocialPostsDocumentJson;
  past: SocialPostsDocumentJson[];
  future: SocialPostsDocumentJson[];
};

type Action =
  | { type: "edit"; update: SocialPostDocumentUpdate }
  | { type: "replace"; document: SocialPostsDocumentJson }
  | { type: "navigate"; update: SocialPostDocumentUpdate }
  | { type: "undo" }
  | { type: "redo" };

/** Format selection and export metadata do not make the artwork dirty. */
export function socialPostContentKey(document: SocialPostsDocumentJson) {
  return JSON.stringify({
    agent: document.agent,
    listing: document.listing,
    variants: document.variants,
  });
}

export function socialPostDraftReducer(
  state: SocialPostDraft,
  action: Action,
): SocialPostDraft {
  if (action.type === "replace")
    return { document: action.document, past: [], future: [] };
  if (action.type === "undo") {
    const previous = state.past.at(-1);
    return previous
      ? {
          document: previous,
          past: state.past.slice(0, -1),
          future: [state.document, ...state.future],
        }
      : state;
  }
  if (action.type === "redo") {
    const next = state.future[0];
    return next
      ? {
          document: next,
          past: [...state.past, state.document],
          future: state.future.slice(1),
        }
      : state;
  }
  const document =
    typeof action.update === "function"
      ? action.update(state.document)
      : action.update;
  if (action.type === "navigate") return { ...state, document };
  if (socialPostContentKey(document) === socialPostContentKey(state.document))
    return state;
  return {
    document,
    past: [...state.past.slice(-49), state.document],
    future: [],
  };
}

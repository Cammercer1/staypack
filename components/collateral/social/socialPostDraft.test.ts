import { describe, expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { buildSocialPostsDocument } from "@/lib/collateral/buildSocialPostsDocument";
import {
  applyDocumentLayerUpdate,
  getLayersForVariant,
} from "@/lib/collateral/social/variantLayers";
import {
  socialPostContentKey,
  socialPostDraftReducer,
  type SocialPostDraft,
} from "./socialPostDraft";

function initial(): SocialPostDraft {
  const fixture = createLintRegressionFixtures();
  return {
    document: buildSocialPostsDocument({
      ...fixture,
      agentProfile: fixture.agent,
      collateral: {
        ...fixture.collateral,
        type: "social_posts",
        template_id: null,
      },
    }),
    past: [],
    future: [],
  };
}

describe("social post editing history", () => {
  it("switches format without making saved artwork dirty", () => {
    const state = initial();
    const next = socialPostDraftReducer(state, {
      type: "navigate",
      update: (doc) => ({
        ...doc,
        active_variant_id: "story",
        layers: getLayersForVariant(doc, "story"),
      }),
    });
    expect(socialPostContentKey(next.document)).toBe(
      socialPostContentKey(state.document),
    );
    expect(next.past).toHaveLength(0);
    expect(next.document.active_variant_id).toBe("story");
  });

  it("undoes and redoes shared wording while preserving each format layout", () => {
    const state = initial();
    const edited = socialPostDraftReducer(state, {
      type: "edit",
      update: (doc) =>
        applyDocumentLayerUpdate(doc, {
          title: { ...doc.layers.title, text: "Just listed" },
        }),
    });
    const switched = socialPostDraftReducer(edited, {
      type: "navigate",
      update: (doc) => ({
        ...doc,
        active_variant_id: "wide",
        layers: getLayersForVariant(doc, "wide"),
      }),
    });
    const undone = socialPostDraftReducer(switched, { type: "undo" });
    expect(undone.document.layers.title.text).toBe(
      state.document.layers.title.text,
    );
    expect(socialPostContentKey(undone.document)).toBe(
      socialPostContentKey(state.document),
    );
    const redone = socialPostDraftReducer(undone, { type: "redo" });
    expect(getLayersForVariant(redone.document, "square").title.text).toBe(
      "Just listed",
    );
    expect(getLayersForVariant(redone.document, "wide").title.text).toBe(
      "Just listed",
    );
    expect(getLayersForVariant(redone.document, "wide").title.scale).toBe(
      getLayersForVariant(state.document, "wide").title.scale,
    );
  });

  it("discards redo after a new edit and clears stale history on restored server data", () => {
    const state = initial();
    const edit = (text: string) => ({
      type: "edit" as const,
      update: (doc: typeof state.document) =>
        applyDocumentLayerUpdate(doc, { title: { ...doc.layers.title, text } }),
    });
    const edited = socialPostDraftReducer(state, edit("Sold"));
    const undone = socialPostDraftReducer(edited, { type: "undo" });
    const replaced = socialPostDraftReducer(undone, edit("Open home"));
    expect(replaced.future).toHaveLength(0);
    expect(
      socialPostDraftReducer(replaced, {
        type: "replace",
        document: state.document,
      }),
    ).toEqual(state);
  });
});

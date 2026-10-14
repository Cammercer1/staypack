import { expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { buildSocialPostsDocument } from "@/lib/collateral/buildSocialPostsDocument";
import { ensureSocialPostsDocument } from "./normalizeSocialDocument";
import { getLayersForVariant, setVariantLayers } from "./variantLayers";
import { socialSavePayload } from "./savePayload";
const data = createLintRegressionFixtures();
const document = ensureSocialPostsDocument(buildSocialPostsDocument({ agency: data.agency, listing: data.listing, collateral: { ...data.collateral, type: "social_posts" } }));
it("does not mark untouched preset layers customized when saving or downloading", () => {
  expect(socialSavePayload(document, document)).not.toHaveProperty("layers");
  expect(socialSavePayload({ ...document, active_variant_id: "story" }, document)).not.toHaveProperty("layers");
});
it("sends real layer edits and retains the other format designs", () => {
  const layers = getLayersForVariant(document, "square");
  const edited = setVariantLayers(document, "square", { ...layers, title: { ...layers.title, text: "Edited title" } });
  const payload = socialSavePayload(edited, document);
  expect(payload.layers?.title.text).toBe("Edited title");
  expect(payload.variants.story).toEqual(document.variants.story);
});

import { describe, expect, it } from "vitest";
import { isProspectPublicSlug, prospectPublicPath, prospectSlugCandidates } from "./publicLinks";

const id = "b6f844fc-5702-4e45-a222-5a4083d59c5e";

describe("prospect public links", () => {
  it("preserves the unit number and includes the company, street and suburb", () => {
    expect(prospectSlugCandidates("property-providers", "6/33 Malvern Avenue", "Manly", id)).toEqual([
      "property-providers/6-33-malvern-avenue-manly",
      "property-providers/6-33-malvern-avenue-manly-b6f844fc",
      `property-providers/6-33-malvern-avenue-manly-${id}`,
    ]);
  });

  it("normalizes punctuation and caps long addresses including collision suffixes", () => {
    for (const candidate of prospectSlugCandidates("Élan & Co", "A ".repeat(200), "St Kilda", id)) {
      expect(candidate.startsWith("elan-and-co/")).toBe(true);
      expect(isProspectPublicSlug(candidate)).toBe(true);
    }
  });

  it.each(["", "company/../private", "//external.example", "company/address?admin=1", "company/address/extra", "company/Address"])("rejects unsafe or malformed slug %s", slug => {
    expect(isProspectPublicSlug(slug)).toBe(false);
  });

  it("uses the saved slug and supports old published token links", () => {
    const public_token = "a".repeat(64);
    expect(prospectPublicPath({ public_slug: "original-brand/original-address", public_token }))
      .toBe("/examples/original-brand/original-address");
    expect(prospectPublicPath({ public_token })).toBe(`/example/${public_token}`);
    expect(prospectPublicPath({})).toBeNull();
  });
});

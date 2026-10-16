import { expect, it } from "vitest";
import { appraisalSubjectFeatures } from "./appraisalSubjectFeatures";

it.each([
  "High quality renovations, high ceilings and engineered timber flooring. Building of 12. Minimal entry stairs.",
  "Polished floors with level access to the ocean.",
  "Ground floor apartment in a high-rise building.",
  "Level 0 apartment with timber flooring.",
])("does not manufacture elevation from unrelated source features: %s", description => {
  expect(appraisalSubjectFeatures(description, 1, 0)).not.toContain("elevated");
});

it.each(["Level 4 apartment", "Top-floor apartment", "Apartment on the second floor", "An elevated position with ocean views"])("retains explicitly described elevation: %s", description => {
  expect(appraisalSubjectFeatures(description, 1, 0)).toContain("elevated position");
});

it("does not turn proximity to the ocean into views or parking into secure parking", () => {
  expect(appraisalSubjectFeatures("Walk to the ocean; single carport.", 3, 1)).toBe("3 bathrooms, off-street parking");
  expect(appraisalSubjectFeatures("Harbour views and secure parking.", 1, 1)).toBe("views, secure parking");
});

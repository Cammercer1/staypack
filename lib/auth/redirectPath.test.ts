import { expect, it } from "vitest";
import { safeAuthRedirect } from "./redirectPath";

it.each([null, undefined, "https://other.test", "//other.test", "/\\other.test", "/\n/other.test"])("rejects an external or ambiguous auth redirect: %s", value => {
  expect(safeAuthRedirect(value)).toBe("/dashboard");
});
it("preserves an internal destination and its query", () => {
  expect(safeAuthRedirect("/appraisals?status=draft")).toBe("/appraisals?status=draft");
});

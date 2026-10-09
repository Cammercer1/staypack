import { describe, expect, it } from "vitest";
import { resolveRentalInspectionCta } from "./inspectionCta";

describe("rental inspection CTA", () => {
  it.each([
    undefined,
    " ",
    "Speak with the agent for the full buyer pack and property details.",
    "Contact us to purchase this property.",
  ])("uses tenant-facing wording for an empty or sales default: %s", (cta) => {
    expect(resolveRentalInspectionCta(cta)).toBe(
      "Contact the agent to arrange an inspection and request rental details.",
    );
  });

  it("preserves an agency's suitable custom wording", () => {
    expect(resolveRentalInspectionCta("  Book your inspection with our team.  ")).toBe(
      "Book your inspection with our team.",
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  assertTemplateGranted,
  TemplateNotGrantedError,
} from "@/lib/templates/grants/assertTemplateGranted";

describe("assertTemplateGranted", () => {
  it("allows platform templates without a grant row", async () => {
    await expect(
      assertTemplateGranted(
        "00000000-0000-4000-8000-000000000099",
        "classic-detailed",
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects unknown template ids", async () => {
    await expect(
      assertTemplateGranted(
        "00000000-0000-4000-8000-000000000099",
        "not-a-real-template",
      ),
    ).rejects.toBeInstanceOf(TemplateNotGrantedError);
  });
});

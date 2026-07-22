import { describe, expect, it } from "vitest";
import { setReportCopyValueAtPath } from "@/lib/reports/editable/reportCopyPaths";
import type { FinalReportJson } from "@/lib/types";

const copy = {
  blurb: "Medium copy",
  blurb_variants: {
    short: "Short copy",
    medium: "Medium copy",
    long: "Long copy\n\nSecond paragraph\n\nThird paragraph",
  },
} as FinalReportJson["copy"];

describe("setReportCopyValueAtPath", () => {
  it("updates the active short variant during inline editing", () => {
    const updated = setReportCopyValueAtPath(
      copy,
      "copy.blurb",
      "Edited short copy",
      { activeBlurbLength: "short" },
    );

    expect(updated.blurb).toBe("Edited short copy");
    expect(updated.blurb_variants?.short).toBe("Edited short copy");
    expect(updated.blurb_variants?.long).toBe(copy.blurb_variants?.long);
  });
});

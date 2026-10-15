import { describe, expect, it } from "vitest";
import { formatEvidenceDate } from "./formatEvidenceDate";

describe("evidence calendar dates", () => {
  it.each(["1 Jul 2026", "1 July 2026", "July 1, 2026", "2026-07-01", "2026-07-01T00:00:00+10:00", "2026-07-01T23:00:00-07:00"])("preserves the written sale day in %s", value => {
    expect(formatEvidenceDate(value)).toBe("1 July 2026");
  });
  it("keeps the written month at year and month boundaries", () => {
    expect(formatEvidenceDate("2026-01-01T00:00:00+11:00")).toBe("1 Jan 2026");
    expect(formatEvidenceDate("2026-07-01T00:00:00+10:00", false)).toBe("July 2026");
  });
  it.each(["Not disclosed", "31 Feb 2026", "2026-02-31", "2026-13-01", ""])("retains unrecognised or invalid date text: %s", value => {
    expect(formatEvidenceDate(value)).toBe(value);
  });
});

import { describe, expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { currentReportSnapshot, preservePublishedReport, publishedReportSnapshot } from "./publicationSnapshot";

describe("report publication snapshots", () => {
  it("keeps the last published content through multiple saves and exposes the current draft only on publication", () => {
    const { report } = createLintRegressionFixtures();
    report.status = "published";
    const original = report.final_report_json!;
    const first = preservePublishedReport(report, { ...original, copy: { ...original.copy, heading: "First draft" } });
    const second = preservePublishedReport({ ...report, final_report_json: first }, {
      ...first, copy: { ...first.copy, heading: "Second draft" },
      document_link_draft: { link: { mode: "custom", url: "https://example.com/private" }, target_url: "https://example.com/private", qr_code_url: "new-qr.png" },
    });
    expect(publishedReportSnapshot(second)).toEqual(original);
    expect(JSON.stringify(publishedReportSnapshot(second))).not.toContain("private");
    const published = currentReportSnapshot(second);
    expect(published.copy.heading).toBe("Second draft");
    expect(published.assets.qr_code_url).toBe("new-qr.png");
    expect(published.published_report_json).toBeUndefined();
    expect(published.document_link_draft).toBeUndefined();
    expect(publishedReportSnapshot(published)).toEqual(published);
  });
  it("does not create a public revision for an unpublished report", () => {
    const { report } = createLintRegressionFixtures();
    const draft = preservePublishedReport({ ...report, status: "generated" }, report.final_report_json!);
    expect(draft.published_report_json).toBeUndefined();
  });
});

// @vitest-environment jsdom
import { useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppraisalDeliveryStep } from "./AppraisalDeliveryStep";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import type { Report } from "@/lib/types";

vi.mock("@/components/reports/FittedReportPreview", () => ({
  FittedReportPreview: () => <div>Report proof</div>,
}));
vi.mock("@/components/documents/DocumentLinkEditor", () => ({
  DocumentLinkEditor: ({ draftPdf }: { draftPdf?: boolean }) => <span>{draftPdf ? "Link applies to draft PDF" : "Link requires publication"}</span>,
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Harness({ initialReport }: { initialReport?: Report }) {
  const [report, setReport] = useState(
    () => initialReport ?? createLintRegressionFixtures().lease,
  );
  return (
    <AppraisalDeliveryStep
      report={report}
      preview={report.final_report_json!}
      onReportChange={setReport}
      onEdit={vi.fn()}
      onBusyChange={vi.fn()}
    />
  );
}

describe("appraisal delivery", () => {
  it.each(["lease", "sales"] as const)("allows a private %s PDF with saved QR changes while preserving the public report", async (kind) => {
    const fixture = createLintRegressionFixtures()[kind];
    const linkDraft = { link: { mode: "custom" as const, url: "https://agency.example/saved-draft" }, target_url: "https://agency.example/saved-draft", qr_code_url: "https://example.test/draft-qr.png" };
    const report: Report = {
      ...fixture,
      status: "published",
      pdf_url: null,
      public_url: "https://example.test/appraisal",
      final_report_json: { ...fixture.final_report_json!, document_link_draft: linkDraft },
    };
    const fetcher = vi.fn().mockResolvedValue(Response.json({ report: { ...report, pdf_url: "https://example.test/saved-draft.pdf" } }));
    vi.stubGlobal("fetch", fetcher);
    render(<Harness initialReport={report} />);
    expect(screen.getByText("Link applies to draft PDF")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Prepare PDF" }));
    await screen.findByRole("link", { name: "Download PDF" });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toBe(`/api/reports/${report.id}/generate-pdf`);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ preview: true });
    expect(screen.getByText("Published online")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Update online report" })).toBeTruthy();
  });

  it("publishes an online report without starting PDF generation", async () => {
    const report = {
      ...createLintRegressionFixtures().lease,
      status: "published",
      public_url: "https://example.test/appraisal",
    };
    const fetcher = vi.fn().mockResolvedValue(Response.json({ report }));
    vi.stubGlobal("fetch", fetcher);
    render(<Harness />);
    fireEvent.click(
      screen.getByRole("button", { name: "Publish online report" }),
    );
    await screen.findByRole("button", { name: "Copy link" });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][0]).toBe("/api/reports/mock-lease/publish");
    expect(screen.getByRole("button", { name: "Prepare PDF" })).toBeTruthy();
  });

  it("allows retry after a PDF network failure and exposes the download only when ready", async () => {
    const report = {
      ...createLintRegressionFixtures().lease,
      pdf_url: "https://example.test/appraisal.pdf",
    };
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("Connection lost"))
      .mockResolvedValueOnce(Response.json({ report }));
    vi.stubGlobal("fetch", fetcher);
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Prepare PDF" }));
    await screen.findByRole("alert");
    expect(screen.queryByRole("link", { name: "Download PDF" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Prepare PDF" }));
    await waitFor(() =>
      expect(screen.getByRole("link", { name: "Download PDF" })).toBeTruthy(),
    );
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
      preview: true,
    });
    expect(
      fetcher.mock.calls.every(([url]) => url.endsWith("/generate-pdf")),
    ).toBe(true);
  });
});

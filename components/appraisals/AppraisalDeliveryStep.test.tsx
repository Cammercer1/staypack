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

vi.mock("@/components/reports/FittedReportPreview", () => ({
  FittedReportPreview: () => <div>Report proof</div>,
}));
vi.mock("@/components/documents/DocumentLinkEditor", () => ({
  DocumentLinkEditor: () => null,
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Harness() {
  const [report, setReport] = useState(
    () => createLintRegressionFixtures().lease,
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

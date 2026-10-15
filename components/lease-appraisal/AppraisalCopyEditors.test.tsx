// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useState } from "react";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { LeaseAppraisalCopyEditor } from "./LeaseAppraisalCopyEditor";
import { SalesAppraisalCopyEditor } from "@/components/sales-appraisal/SalesAppraisalCopyEditor";
import type { Report } from "@/lib/types";

vi.mock("@/components/reports/FittedReportPreview", () => ({ FittedReportPreview: () => <div>Document preview</div> }));
vi.mock("@/components/reports/inline/ReportImagePickerDialog", () => ({ ReportImagePickerDialog: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function editor(kind: "lease" | "sales") {
  const fixture = createLintRegressionFixtures();
  const report = fixture[kind];
  const onReportChange = vi.fn();
  const onContinueToPreview = vi.fn();
  const onCollateralChange = vi.fn();
  const Component = kind === "lease" ? LeaseAppraisalCopyEditor : SalesAppraisalCopyEditor;
  render(<Component agency={fixture.agency} agencyAgents={[fixture.agent]} listing={fixture.listing} report={report}
    collateral={kind === "lease" ? fixture.leaseCollateral : fixture.salesCollateral} onListingChange={vi.fn()}
    onReportChange={onReportChange} onCollateralChange={onCollateralChange} onContinueToPreview={onContinueToPreview} />);
  return { report, onReportChange, onContinueToPreview, onCollateralChange };
}

it.each(["lease", "sales"] as const)("saves edited %s marketing copy before opening the review step", async kind => {
  let finishSave: (response: Response) => void = () => {};
  const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise<Response>(resolve => { finishSave = resolve; }));
  vi.stubGlobal("fetch", fetcher);
  const { report, onReportChange, onContinueToPreview } = editor(kind);
  fireEvent.click(screen.getByText("All report fields"));
  fireEvent.change(screen.getByLabelText("Heading"), { target: { value: "A home with room to grow" } });
  fireEvent.change(screen.getByLabelText("Key points"), { target: { value: "Bright living spaces\nFlexible floor plan" } });
  fireEvent.click(screen.getByRole("button", { name: /Save & preview/ }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  expect(onContinueToPreview).not.toHaveBeenCalled();
  expect((screen.getByRole("button", { name: /Saving/ }) as HTMLButtonElement).disabled).toBe(true);
  const [url, init] = fetcher.mock.calls[0];
  expect(url).toBe(`/api/reports/${report.id}/${kind === "lease" ? "lease" : "sales"}-appraisal-copy`);
  expect(init?.method).toBe("PATCH");
  expect(JSON.parse(String(init?.body))).toMatchObject({ template_id: report.template_id, copy: { heading: "A home with room to grow", appeal_points: ["Bright living spaces", "Flexible floor plan"] } });
  finishSave(Response.json({ report }));
  await waitFor(() => expect(onContinueToPreview).toHaveBeenCalledTimes(1));
  expect(onReportChange).toHaveBeenCalledWith(report);
});

it.each(["lease", "sales"] as const)("keeps %s copy edits available when saving fails", async kind => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(Response.json({ error: "Please try again" }, { status: 500 })));
  const { onContinueToPreview } = editor(kind);
  fireEvent.click(screen.getByText("All report fields"));
  fireEvent.change(screen.getByLabelText("Call to action"), { target: { value: "Discuss your property with our team" } });
  fireEvent.click(screen.getByRole("button", { name: /Save & preview/ }));
  expect((await screen.findByRole("alert")).textContent).toContain("couldn’t be saved");
  expect(onContinueToPreview).not.toHaveBeenCalled();
  expect((screen.getByLabelText("Call to action") as HTMLInputElement).value).toBe("Discuss your property with our team");
  expect((screen.getByRole("button", { name: /Save & preview/ }) as HTMLButtonElement).disabled).toBe(false);
});

it.each(["lease", "sales"] as const)("requires confirmation before regenerating %s copy", async kind => {
  const fetcher = vi.fn<typeof fetch>();
  vi.stubGlobal("fetch", fetcher);
  const { report, onCollateralChange } = editor(kind);
  fetcher.mockResolvedValue(Response.json({ report }));
  fireEvent.click(screen.getByText("Rewrite content"));
  fireEvent.click(screen.getByRole("button", { name: "Regenerate copy" }));
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm regenerate" }));
  await waitFor(() => expect(onCollateralChange).toHaveBeenCalledWith(expect.objectContaining({ status: "generated", template_id: report.template_id })));
  expect(fetcher.mock.calls[0][0]).toBe(`/api/reports/${report.id}/generate-${kind === "lease" ? "lease" : "sales"}-appraisal`);
  expect(fetcher.mock.calls[0][1]?.method).toBe("POST");
});

it.each(["lease", "sales"] as const)("preserves spaces and newlines while typing %s list fields, cleaning them only when saved", async kind => {
  const { report } = editor(kind);
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ report }));
  vi.stubGlobal("fetch", fetcher);
  fireEvent.click(screen.getByText("All report fields"));
  for (const label of ["Key points", "Supporting factors"]) {
    const field = screen.getByLabelText(label) as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: "" } });
    for (const character of "Bright rooms\nSecure parking\n") {
      fireEvent.change(field, { target: { value: field.value + character } });
    }
    expect(field.value).toBe("Bright rooms\nSecure parking\n");
  }
  fireEvent.click(screen.getByRole("button", { name: /Save & preview/ }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).copy).toMatchObject({
    appeal_points: ["Bright rooms", "Secure parking"],
    supporting_factors: ["Bright rooms", "Secure parking"],
  });
});

function statefulEditor(kind: "lease" | "sales") {
  const fixture = createLintRegressionFixtures();
  const original = fixture[kind];
  const onContinueToPreview = vi.fn();
  const onReportChange = vi.fn();
  function Harness() {
    const [report, setReport] = useState(original);
    const Component = kind === "lease" ? LeaseAppraisalCopyEditor : SalesAppraisalCopyEditor;
    return <Component agency={fixture.agency} agencyAgents={[fixture.agent]} listing={fixture.listing} report={report}
      collateral={kind === "lease" ? fixture.leaseCollateral : fixture.salesCollateral} onListingChange={vi.fn()}
      onReportChange={(next: Report) => { onReportChange(next); setReport(next); }} onCollateralChange={vi.fn()}
      onContinueToPreview={onContinueToPreview} />;
  }
  render(<Harness />);
  const saved = (heading: string): Report => ({
    ...original,
    updated_at: "2099-01-01T00:00:00Z",
    final_report_json: { ...original.final_report_json!, copy: { ...original.final_report_json!.copy, heading } },
  });
  return { saved, onContinueToPreview, onReportChange };
}

it.each(["lease", "sales"] as const)("saves newer %s edits before allowing a slow save to open preview", async kind => {
  const responses: ((response: Response) => void)[] = [];
  const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise<Response>(resolve => responses.push(resolve)));
  vi.stubGlobal("fetch", fetcher);
  const { saved, onContinueToPreview, onReportChange } = statefulEditor(kind);
  fireEvent.click(screen.getByText("All report fields"));
  fireEvent.change(screen.getByLabelText("Heading"), { target: { value: "First heading" } });
  fireEvent.click(screen.getByRole("button", { name: /Save & preview/ }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText("Heading"), { target: { value: "Newer heading" } });
  responses[0](Response.json({ report: saved("First heading") }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(onReportChange).not.toHaveBeenCalled();
  expect(onContinueToPreview).not.toHaveBeenCalled();
  expect((screen.getByLabelText("Heading") as HTMLInputElement).value).toBe("Newer heading");
  expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body)).copy.heading).toBe("Newer heading");
  responses[1](Response.json({ report: saved("Newer heading") }));
  await waitFor(() => expect(onContinueToPreview).toHaveBeenCalledOnce());
  expect(onReportChange).toHaveBeenCalledOnce();
  expect((screen.getByLabelText("Heading") as HTMLInputElement).value).toBe("Newer heading");
});

it.each(["lease", "sales"] as const)("retains newer %s edits if their follow-up save fails and retries them", async kind => {
  const responses: ((response: Response) => void)[] = [];
  const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise<Response>(resolve => responses.push(resolve)));
  vi.stubGlobal("fetch", fetcher);
  const { saved, onContinueToPreview, onReportChange } = statefulEditor(kind);
  fireEvent.click(screen.getByText("All report fields"));
  fireEvent.change(screen.getByLabelText("Heading"), { target: { value: "First heading" } });
  fireEvent.click(screen.getByRole("button", { name: /Save & preview/ }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText("Heading"), { target: { value: "Keep this newer heading" } });
  responses[0](Response.json({ report: saved("First heading") }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  responses[1](Response.json({ error: "Connection lost" }, { status: 500 }));
  await screen.findByRole("alert");
  expect(onReportChange).not.toHaveBeenCalled();
  expect(onContinueToPreview).not.toHaveBeenCalled();
  expect((screen.getByLabelText("Heading") as HTMLInputElement).value).toBe("Keep this newer heading");
  fireEvent.click(screen.getByRole("button", { name: /Save & preview/ }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
  expect(JSON.parse(String(fetcher.mock.calls[2][1]?.body)).copy.heading).toBe("Keep this newer heading");
  responses[2](Response.json({ report: saved("Keep this newer heading") }));
  await waitFor(() => expect(onContinueToPreview).toHaveBeenCalledOnce());
});

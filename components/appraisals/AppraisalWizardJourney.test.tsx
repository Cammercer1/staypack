// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useImperativeHandle, type Ref } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LeaseAppraisalWizard } from "@/components/lease-appraisal/LeaseAppraisalWizard";
import { SalesAppraisalWizard } from "@/components/sales-appraisal/SalesAppraisalWizard";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";

const save = vi.hoisted(() => vi.fn().mockResolvedValue(true));
function Data({ onContinue }: { onContinue: () => void }) {
  return <button onClick={onContinue}>Save reviewed evidence</button>;
}
function Editor({ ref }: { ref?: Ref<unknown> }) {
  useImperativeHandle(ref, () => ({ savePendingEdits: save }));
  return <p>Editable report</p>;
}
vi.mock("@/components/lease-appraisal/LeaseAppraisalDataStep", () => ({
  LeaseAppraisalDataStep: Data,
}));
vi.mock("@/components/sales-appraisal/SalesAppraisalDataStep", () => ({
  SalesAppraisalDataStep: Data,
}));
vi.mock("@/components/lease-appraisal/LeaseAppraisalCopyEditor", () => ({
  LeaseAppraisalCopyEditor: Editor,
}));
vi.mock("@/components/sales-appraisal/SalesAppraisalCopyEditor", () => ({
  SalesAppraisalCopyEditor: Editor,
}));
vi.mock("@/components/appraisals/AppraisalDeliveryStep", () => ({
  AppraisalDeliveryStep: () => <p>Delivery workspace</p>,
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  save.mockReset().mockResolvedValue(true);
});

for (const kind of ["lease", "sales"] as const) {
  const Component =
    kind === "lease" ? LeaseAppraisalWizard : SalesAppraisalWizard;
  describe(`${kind} wizard handoffs`, () => {
    it("generates immediately after reviewing evidence and opens the editable report", async () => {
      const fixtures = createLintRegressionFixtures();
      let complete!: (response: Response) => void;
      const fetcher = vi.fn<
        (url: string, init?: RequestInit) => Promise<Response>
      >(
        () =>
          new Promise<Response>((resolve) => {
            complete = resolve;
          }),
      );
      vi.stubGlobal("fetch", fetcher);
      render(
        <Component
          agency={fixtures.agency}
          initialListing={fixtures.listing}
          initialReport={{ ...fixtures[kind], final_report_json: null }}
          initialCollateral={
            kind === "lease"
              ? fixtures.leaseCollateral
              : fixtures.salesCollateral
          }
          initialAgencyAgents={[]}
          skipTemplateSelection
        />,
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Save reviewed evidence" }),
      );
      expect(
        screen.getByRole("heading", { name: "Writing your appraisal" }),
      ).toBeTruthy();
      expect(fetcher).toHaveBeenCalledOnce();
      expect(fetcher.mock.calls[0][0]).toBe(
        `/api/reports/mock-${kind}/generate-${kind}-appraisal`,
      );
      complete(Response.json({ report: fixtures[kind] }));
      await screen.findByText("Editable report");
    });
    it("blocks delivery navigation when the editor cannot save, then allows retry", async () => {
      const fixtures = createLintRegressionFixtures();
      vi.stubGlobal("fetch", vi.fn());
      render(
        <Component
          agency={fixtures.agency}
          initialListing={fixtures.listing}
          initialReport={fixtures[kind]}
          initialCollateral={
            kind === "lease"
              ? fixtures.leaseCollateral
              : fixtures.salesCollateral
          }
          initialAgencyAgents={[]}
        />,
      );
      fireEvent.click(screen.getByRole("tab", { name: "Edit report" }));
      save.mockResolvedValueOnce(false);
      fireEvent.click(screen.getByRole("tab", { name: "Download & share" }));
      await waitFor(() => expect(save).toHaveBeenCalledOnce());
      expect(screen.getByText("Editable report")).toBeTruthy();
      fireEvent.click(screen.getByRole("tab", { name: "Download & share" }));
      await screen.findByText("Delivery workspace");
    });
  });
}

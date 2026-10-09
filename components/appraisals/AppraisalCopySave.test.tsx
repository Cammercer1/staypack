// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LeaseAppraisalCopyEditor } from "@/components/lease-appraisal/LeaseAppraisalCopyEditor";
import { SalesAppraisalCopyEditor } from "@/components/sales-appraisal/SalesAppraisalCopyEditor";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";

vi.mock("@/components/reports/FittedReportPreview", () => ({
  FittedReportPreview: ({
    editable,
  }: {
    editable: {
      setField: (path: string, value: string) => void;
      blurbFlushRef: { current: (() => string | null) | null };
      onFieldFocus: (path: string) => void;
    };
  }) => {
    editable.blurbFlushRef.current ??= () => "Template-sized description";
    return (
      <>
        <button
          onClick={() => editable.setField("copy.heading", "Reviewed heading")}
        >
          Edit heading
        </button>
        <button
          onClick={() => {
            editable.onFieldFocus("copy.blurb");
            editable.blurbFlushRef.current = () => "Just-typed description";
          }}
        >
          Type description without waiting
        </button>
      </>
    );
  },
}));
vi.mock("@/components/reports/inline/ReportImagePickerDialog", () => ({
  ReportImagePickerDialog: () => null,
}));
vi.mock("@/components/collateral/sales-brochure/BlurbVariantsEditor", () => ({
  BlurbVariantsEditor: () => null,
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

for (const kind of ["lease", "sales"] as const) {
  const Component =
    kind === "lease" ? LeaseAppraisalCopyEditor : SalesAppraisalCopyEditor;
  function setup() {
    const fixtures = createLintRegressionFixtures();
    const onContinueToPreview = vi.fn();
    const report = fixtures[kind];
    render(
      <Component
        agency={fixtures.agency}
        agencyAgents={[]}
        listing={fixtures.listing}
        report={report}
        collateral={
          kind === "lease" ? fixtures.leaseCollateral : fixtures.salesCollateral
        }
        onListingChange={vi.fn()}
        onReportChange={vi.fn()}
        onCollateralChange={vi.fn()}
        onContinueToPreview={onContinueToPreview}
      />,
    );
    return { onContinueToPreview };
  }
  describe(`${kind} save and preview`, () => {
    it("saves edited content and continues with one action", async () => {
      const fetcher = vi.fn().mockResolvedValue(Response.json({}));
      vi.stubGlobal("fetch", fetcher);
      const { onContinueToPreview } = setup();
      fireEvent.click(screen.getByRole("button", { name: "Edit heading" }));
      fireEvent.click(
        screen.getAllByRole("button", { name: "Save & preview" })[0],
      );
      await waitFor(() => expect(onContinueToPreview).toHaveBeenCalledOnce());
      expect(fetcher).toHaveBeenCalledOnce();
      expect(JSON.parse(fetcher.mock.calls[0][1].body).copy.heading).toBe(
        "Reviewed heading",
      );
    });
    it("continues without a redundant save when no content changed", async () => {
      const fetcher = vi.fn();
      vi.stubGlobal("fetch", fetcher);
      const { onContinueToPreview } = setup();
      fireEvent.click(
        screen.getByRole("button", { name: "Review & download" }),
      );
      await waitFor(() => expect(onContinueToPreview).toHaveBeenCalledOnce());
      expect(fetcher).not.toHaveBeenCalled();
    });
    it("flushes a just-typed description before the editor debounce runs", async () => {
      const fetcher = vi.fn().mockResolvedValue(Response.json({}));
      vi.stubGlobal("fetch", fetcher);
      const { onContinueToPreview } = setup();
      fireEvent.click(
        screen.getByRole("button", {
          name: "Type description without waiting",
        }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Review & download" }),
      );
      await waitFor(() => expect(onContinueToPreview).toHaveBeenCalledOnce());
      expect(JSON.parse(fetcher.mock.calls[0][1].body).copy.blurb).toBe(
        "Just-typed description",
      );
    });
    it("keeps edits available and allows retry after a network failure", async () => {
      const fetcher = vi
        .fn()
        .mockRejectedValueOnce(new Error("Connection lost"))
        .mockResolvedValueOnce(Response.json({}));
      vi.stubGlobal("fetch", fetcher);
      const { onContinueToPreview } = setup();
      fireEvent.click(screen.getByRole("button", { name: "Edit heading" }));
      fireEvent.click(
        screen.getAllByRole("button", { name: "Save & preview" })[0],
      );
      await screen.findByText(
        "Your changes couldn’t be saved. Try Save & preview again.",
      );
      expect(onContinueToPreview).not.toHaveBeenCalled();
      fireEvent.click(
        screen.getAllByRole("button", { name: "Save & preview" })[0],
      );
      await waitFor(() => expect(onContinueToPreview).toHaveBeenCalledOnce());
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
  });
}

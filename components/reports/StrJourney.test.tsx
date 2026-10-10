// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { ReportWizard } from "./ReportWizard";
import { FittedReportPreview } from "./FittedReportPreview";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import {
  buildFinalReportJson,
  getMockAiCopy,
} from "@/lib/reports/buildFinalReportJson";
import { finalReportCopyToAiCopy } from "@/lib/reports/editable/strReportCopyAdapter";
import { getTemplatesForProduct } from "@/lib/templates/catalog";
import { serializeTemplateForApi } from "@/lib/templates/serializeForApi";
import { applyStrEstimateAdjustments, reconcileStrEstimate, readStrRateOverride, saveStrRateOverride } from "@/lib/reports/strEstimateAdjustments";
import type { Report } from "@/lib/types";

vi.mock("./FittedReportPreview", () => ({
  FittedReportPreview: ({
    report,
    editable,
  }: ComponentProps<typeof FittedReportPreview>) => {
    if (!editable) return <p>{report.copy.heading}</p>;
    return (
      <>
        <button
          onClick={() =>
            editable.setField("copy.heading", "Reviewed STR headline")
          }
        >
          Edit headline inline
        </button>
        <button
          onClick={() => {
            if (editable.blurbFlushRef)
              editable.blurbFlushRef.current = () => "Just typed description";
          }}
        >
          Type before debounce
        </button>
      </>
    );
  },
}));
vi.mock("./inline/ReportImagePickerDialog", () => ({
  ReportImagePickerDialog: ({
    open,
    onSelect,
  }: {
    open: boolean;
    onSelect: (url: string) => void;
  }) =>
    open ? (
      <button onClick={() => onSelect("https://example.test/new-cover.jpg")}>
        Choose new photo
      </button>
    ) : null,
}));
vi.mock("@/components/collateral/sales-brochure/BlurbVariantsEditor", () => ({
  BlurbVariantsEditor: () => null,
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function setup(draft = false) {
  const fixtures = createLintRegressionFixtures();
  let listing = { ...fixtures.listing };
  let report: Report = {
    ...fixtures.report,
    pdf_url: "old.pdf",
    ...(draft
      ? {
          template_id: null,
          status: "draft" as const,
          ai_copy_json: null,
          final_report_json: null,
          final_estimate_json: null,
        }
      : {}),
  };
  const failures = {
    save: false,
    estimate: false,
    generation: false,
    pdf: false,
  };
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : {};
    if (url === "/api/agents")
      return Response.json({ agents: [fixtures.agent] });
    if (url === "/api/agencies")
      return Response.json({ agency: fixtures.agency });
    if (init?.method === "PATCH" && failures.save) throw new Error("Offline");
    if (url === "/api/listings/mock-listing") {
      listing = { ...listing, ...body };
      return Response.json({ listing });
    }
    if (url === "/api/str/estimate") {
      if (failures.estimate)
        return Response.json(
          { error: "Estimate unavailable" },
          { status: 400 },
        );
      listing = {
        ...listing,
        bedrooms: body.bedrooms,
        bathrooms: body.bathrooms,
        accommodates: body.accommodates,
      };
      const rates = readStrRateOverride(report);
      report = {
        ...report,
        original_estimate_json: fixtures.report.original_estimate_json,
        final_estimate_json: rates ? applyStrEstimateAdjustments(fixtures.report.original_estimate_json!, rates) : fixtures.report.final_estimate_json,
        str_enrichment_json: fixtures.report.str_enrichment_json,
        user_overrides_json: {
          ...saveStrRateOverride(report.user_overrides_json, rates),
          estimateInputs: {
            bedrooms: body.bedrooms,
            bathrooms: body.bathrooms,
            accommodates: body.accommodates,
          },
        },
        pdf_url: null,
      };
    } else if (url.endsWith("generate-copy")) {
      if (failures.generation)
        return Response.json({ error: "Writing unavailable" }, { status: 400 });
      report = {
        ...report,
        ai_copy_json: getMockAiCopy(listing, fixtures.agency),
        pdf_url: null,
      };
    } else if (url.endsWith("generate-pdf")) {
      if (failures.pdf)
        return Response.json(
          { error: "Rendering unavailable" },
          { status: 400 },
        );
      report = { ...report, pdf_url: "new.pdf" };
    } else if (url.endsWith("publish")) {
      report = {
        ...report,
        public_url: "https://example.test/report",
        status: "published",
      };
    } else if (init?.method === "PATCH") {
      if (body.str_adjustment) {
        const rates = body.str_adjustment.mode === "rates"
          ? { nightlyRate: body.str_adjustment.nightlyRate, occupancyRate: body.str_adjustment.occupancyRate } : null;
        body.final_estimate_json = rates ? applyStrEstimateAdjustments(report.original_estimate_json!, rates) : reconcileStrEstimate(report.original_estimate_json!);
        body.user_overrides_json = saveStrRateOverride(report.user_overrides_json, rates);
      }
      report = {
        ...report,
        ...body,
        ai_copy_json: body.copy
          ? finalReportCopyToAiCopy(body.copy, report.ai_copy_json)
          : report.ai_copy_json,
        pdf_url: null,
      };
    }
    if (
      report.ai_copy_json &&
      report.final_estimate_json &&
      !url.endsWith("generate-pdf") &&
      init?.method
    )
      report.final_report_json = buildFinalReportJson({
        agency: fixtures.agency,
        listing,
        report,
        estimate: report.final_estimate_json,
        copy: report.ai_copy_json,
        propertyImages:
          body.property_images ??
          (report.final_report_json
            ? {
                hero_image_url:
                  report.final_report_json.property.hero_image_url,
                selected_image_urls:
                  report.final_report_json.property.selected_image_urls,
              }
            : null),
      });
    return Response.json({ report, listing });
  });
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal("scrollTo", vi.fn());
  const templates = getTemplatesForProduct("str")
    .filter((t) => t.scope === "platform")
    .map(serializeTemplateForApi);
  render(
    <ReportWizard
      agency={fixtures.agency}
      initialListing={listing}
      initialReport={report}
      availableTemplates={{ templates, default_template_id: templates[0].id }}
    />,
  );
  return {
    fetcher,
    failures,
    getReport: () => report,
    getListing: () => listing,
  };
}
const clickTab = (name: string) =>
  fireEvent.click(screen.getByRole("tab", { name }));
const waitTab = (name: string) =>
  waitFor(() =>
    expect(
      screen.getByRole("tab", { name }).getAttribute("aria-selected"),
    ).toBe("true"),
  );

describe("short-term rental report journey", () => {
  it("goes from design to evidence to generated content without an empty generation step", async () => {
    const { fetcher } = setup(true);
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Use design & get estimate",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Use design & get estimate" }),
    );
    await waitTab("Estimate & evidence");
    expect(
      screen.getByRole("region", { name: "Comparable evidence" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Use estimate & generate report" }),
    );
    await waitTab("Edit report");
    expect(screen.getByLabelText("Heading")).toBeTruthy();
    expect(
      fetcher.mock.calls.filter(([url]) => url.endsWith("generate-copy")),
    ).toHaveLength(1);
    expect(
      fetcher.mock.calls.filter(([url]) => url === "/api/str/estimate"),
    ).toHaveLength(1);
  });
  it("validates property inputs before starting the estimate", async () => {
    const { fetcher } = setup(true);
    fireEvent.change(screen.getByLabelText("Guest capacity"), {
      target: { value: "0" },
    });
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Use design & get estimate",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Use design & get estimate" }),
    );
    expect(await screen.findByText("Enter the guest capacity")).toBeTruthy();
    expect(
      fetcher.mock.calls.some(([url]) => url === "/api/str/estimate"),
    ).toBe(false);
  });
  it("retains property edits and unlocks retry when estimating fails", async () => {
    const { failures } = setup(true);
    failures.estimate = true;
    fireEvent.change(screen.getByLabelText("Guest capacity"), {
      target: { value: "6" },
    });
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Use design & get estimate",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Use design & get estimate" }),
    );
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Estimate unavailable",
    );
    expect(screen.getByLabelText("Guest capacity")).toHaveProperty(
      "value",
      "6",
    );
    failures.estimate = false;
    fireEvent.click(
      screen.getByRole("button", { name: "Use design & get estimate" }),
    );
    await waitTab("Estimate & evidence");
  });
  it("saves text, a photo and pending inline text before the Download tab can open", async () => {
    const { getReport, fetcher } = setup();
    clickTab("Edit report");
    await waitTab("Edit report");
    fireEvent.change(screen.getByLabelText("Heading"), {
      target: { value: "Reviewed STR headline" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Type before debounce" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Change cover photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose new photo" }));
    clickTab("Download & share");
    await waitTab("Download & share");
    expect(getReport().final_report_json?.copy.heading).toBe(
      "Reviewed STR headline",
    );
    expect(getReport().final_report_json?.copy.blurb).toBe(
      "Just typed description",
    );
    expect(getReport().final_report_json?.property.hero_image_url).toBe(
      "https://example.test/new-cover.jpg",
    );
    expect(getReport().pdf_url).toBeNull();
    expect(
      fetcher.mock.calls.filter(([url]) => url.endsWith("str-report-copy")),
    ).toHaveLength(1);
    clickTab("Edit report");
    await waitTab("Edit report");
    expect(screen.getByLabelText("Heading")).toHaveProperty(
      "value",
      "Reviewed STR headline",
    );
  });
  it("keeps edits on the editor after a failed save and saves them on retry", async () => {
    const { failures, getReport } = setup();
    clickTab("Edit report");
    await waitTab("Edit report");
    fireEvent.change(screen.getByLabelText("Heading"), {
      target: { value: "Keep my edits" },
    });
    failures.save = true;
    clickTab("Download & share");
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("still here"),
    );
    await waitTab("Edit report");
    expect(screen.getByLabelText("Heading")).toHaveProperty(
      "value",
      "Keep my edits",
    );
    failures.save = false;
    fireEvent.click(screen.getByRole("button", { name: "Review & download" }));
    await waitTab("Download & share");
    expect(getReport().final_report_json?.copy.heading).toBe("Keep my edits");
  });
  it("saves adjusted figures without another estimate request and does not clamp partially typed amounts", async () => {
    const { getReport, fetcher } = setup();
    clickTab("Estimate & evidence");
    await waitTab("Estimate & evidence");
    fireEvent.change(screen.getByLabelText("Average daily rate · ADR ($)"), {
      target: { value: "1" },
    });
    expect(
      screen.getByLabelText("Average daily rate · ADR ($)"),
    ).toHaveProperty("value", "1");
    fireEvent.change(screen.getByLabelText("Average daily rate · ADR ($)"), {
      target: { value: "400" },
    });
    fireEvent.change(screen.getByLabelText("Estimated occupancy (%)"), {
      target: { value: "75" },
    });
    clickTab("Design & property");
    await waitTab("Design & property");
    expect(fetcher.mock.calls.some(([url]) => url === "/api/str/estimate")).toBe(false);
    expect(getReport().final_estimate_json?.annualRevenue).toBe(109500);
    expect(getReport().final_estimate_json?.bookedNights).toBe(274);
    expect(getReport().pdf_url).toBeNull();
  });
  it("recovers from PDF failures and publishes independently of PDF generation", async () => {
    const { fetcher, failures } = setup();
    failures.pdf = true;
    fireEvent.click(screen.getByRole("button", { name: "Prepare again" }));
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Rendering unavailable",
    );
    failures.pdf = false;
    fireEvent.click(screen.getByRole("button", { name: "Prepare again" }));
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Prepare again",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Publish online report" }),
    );
    await screen.findByText("Published online");
    expect(
      fetcher.mock.calls.filter(([url]) => url.endsWith("generate-pdf")),
    ).toHaveLength(2);
    expect(
      fetcher.mock.calls.filter(([url]) => url.endsWith("publish")),
    ).toHaveLength(1);
  });
  it("retains the evidence step after generation fails and can retry", async () => {
    const { failures } = setup(true);
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Use design & get estimate",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Use design & get estimate" }),
    );
    await waitTab("Estimate & evidence");
    failures.generation = true;
    fireEvent.click(
      screen.getByRole("button", { name: "Use estimate & generate report" }),
    );
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Writing unavailable",
    );
    await waitTab("Estimate & evidence");
    failures.generation = false;
    fireEvent.click(
      screen.getByRole("button", { name: "Use estimate & generate report" }),
    );
    await waitTab("Edit report");
  });

  it("keeps unsaved estimate adjustments visible when saving fails", async () => {
    const { failures } = setup();
    clickTab("Estimate & evidence");
    await waitTab("Estimate & evidence");
    fireEvent.change(screen.getByLabelText("Average daily rate · ADR ($)"), {
      target: { value: "400" },
    });
    failures.save = true;
    clickTab("Download & share");
    await screen.findByRole("alert");
    await waitTab("Estimate & evidence");
    expect(
      screen.getByLabelText("Average daily rate · ADR ($)"),
    ).toHaveProperty("value", "400");
    failures.save = false;
    clickTab("Download & share");
    await waitTab("Download & share");
  });

  it("saves an optional sale price without rerunning the estimate or regenerating wording", async () => {
    const { getListing, getReport, fetcher } = setup();
    clickTab("Design & property");
    await waitTab("Design & property");
    fireEvent.change(
      screen.getByLabelText("Advertised sale price (optional)"),
      { target: { value: "$1,400,000" } },
    );
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Use design & review estimate",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Use design & review estimate" }),
    );
    await waitTab("Estimate & evidence");
    expect(getListing().advertised_sale_price).toBe("$1,400,000");
    expect(getReport().final_report_json?.property.display_price).toBe(
      "$1,400,000",
    );
    expect(getReport().pdf_url).toBeNull();
    expect(
      fetcher.mock.calls.some(
        ([url]) =>
          url === "/api/str/estimate" || url.endsWith("generate-copy"),
      ),
    ).toBe(false);
  });

  it("refreshes the estimate when guest capacity changes", async () => {
    const { getListing, fetcher } = setup();
    clickTab("Design & property");
    await waitTab("Design & property");
    fireEvent.change(screen.getByLabelText("Guest capacity"), {
      target: { value: "6" },
    });
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Use design & review estimate",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Use design & review estimate" }),
    );
    await waitTab("Estimate & evidence");
    expect(getListing().accommodates).toBe(6);
    expect(
      fetcher.mock.calls.filter(([url]) => url === "/api/str/estimate"),
    ).toHaveLength(1);
  });
});

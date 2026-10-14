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
    if (!editable) return <><p>{report.copy.heading}</p><span data-testid="preview-revenue">{report.str.annual_revenue}</span></>;
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

function setup(draft = false, options: { report?: Partial<Report>; noTemplates?: boolean; customerEditing?: boolean } = {}) {
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
    ...options.report,
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
    if (url === "/api/listings/mock-listing/property-profile")
      return Response.json({ listing, cached: true });
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
      if (body.str_property) {
        body.user_overrides_json = { ...report.user_overrides_json, strProperty: body.str_property };
        delete body.str_property;
      }
      if (body.str_adjustment) {
        const rates = body.str_adjustment.mode !== "baseline"
          ? { nightlyRate: body.str_adjustment.nightlyRate, occupancyRate: body.str_adjustment.occupancyRate } : null;
        body.final_estimate_json = rates ? applyStrEstimateAdjustments(report.original_estimate_json!, rates) : reconcileStrEstimate(report.original_estimate_json!);
        body.user_overrides_json = saveStrRateOverride(report.user_overrides_json, rates,
          body.str_adjustment.mode === "management" ? body.str_adjustment.assumptions : null);
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
  const rendered = render(
    <ReportWizard
      agency={fixtures.agency}
      initialListing={listing}
      initialReport={report}
      customerEditing={options.customerEditing}
      customerPanel={<p>Customer details panel</p>}
      appraisalActions={<button>Archive</button>}
      availableTemplates={{ templates: options.noTemplates ? [] : templates, default_template_id: options.noTemplates ? "" : templates[0].id }}
    />,
  );
  return {
    fetcher,
    failures,
    templates,
    unmount: rendered.unmount,
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
  it("goes from property to evidence to design, then writes content only after choosing a design", async () => {
    const { fetcher } = setup(true);
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Get estimate & evidence",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Get estimate & evidence" }),
    );
    await waitTab("Estimate & evidence");
    expect(
      screen.getByRole("region", { name: "Comparable evidence" }),
    ).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Use estimate & choose design" }),
    );
    await waitTab("Design & content");
    expect(screen.queryByLabelText("Heading")).toBeNull();
    expect(fetcher.mock.calls.some(([url]) => url.endsWith("generate-copy"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Use design & write report" }));
    expect(await screen.findByLabelText("Heading")).toBeTruthy();
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
            name: "Get estimate & evidence",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Get estimate & evidence" }),
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
            name: "Get estimate & evidence",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Get estimate & evidence" }),
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
      screen.getByRole("button", { name: "Get estimate & evidence" }),
    );
    await waitTab("Estimate & evidence");
  });
  it("saves text, a photo and pending inline text before the Download tab can open", async () => {
    const { getReport, fetcher } = setup();
    clickTab("Design & content");
    await waitTab("Design & content");
    fireEvent.change(screen.getByLabelText("Heading"), {
      target: { value: "Reviewed STR headline" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Type before debounce" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Change cover photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose new photo" }));
    clickTab("Review & share");
    await waitTab("Review & share");
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
    clickTab("Design & content");
    await waitTab("Design & content");
    expect(screen.getByLabelText("Heading")).toHaveProperty(
      "value",
      "Reviewed STR headline",
    );
  });
  it("keeps edits on the editor after a failed save and saves them on retry", async () => {
    const { failures, getReport } = setup();
    clickTab("Design & content");
    await waitTab("Design & content");
    fireEvent.change(screen.getByLabelText("Heading"), {
      target: { value: "Keep my edits" },
    });
    failures.save = true;
    clickTab("Review & share");
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      expect.stringContaining("still here"),
    );
    await waitTab("Design & content");
    expect(screen.getByLabelText("Heading")).toHaveProperty(
      "value",
      "Keep my edits",
    );
    failures.save = false;
    fireEvent.click(screen.getByRole("button", { name: "Review & download" }));
    await waitTab("Review & share");
    expect(getReport().final_report_json?.copy.heading).toBe("Keep my edits");
  });
  it("saves adjusted figures without another estimate request and does not clamp partially typed amounts", async () => {
    const { getReport, fetcher } = setup();
    clickTab("Estimate & evidence");
    await waitTab("Estimate & evidence");
    fireEvent.click(screen.getByRole("button", { name: "Fine-tune assumptions" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    clickTab("Property");
    await waitTab("Property");
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
  it("retains the design and saved evidence after generation fails and can retry", async () => {
    const { failures, fetcher, templates, getReport } = setup(true);
    fireEvent.click(screen.getByRole("button", { name: "Get estimate & evidence" }));
    await waitTab("Estimate & evidence");
    fireEvent.click(screen.getByRole("button", { name: "Use estimate & choose design" }));
    await waitTab("Design & content");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(templates[1].label) }));
    failures.generation = true;
    fireEvent.click(screen.getByRole("button", { name: "Use design & write report" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Writing unavailable");
    await waitTab("Design & content");
    expect(getReport().template_id).toBe(templates[1].id);
    failures.generation = false;
    fireEvent.click(screen.getByRole("button", { name: "Use design & write report" }));
    await screen.findByLabelText("Heading");
    expect(fetcher.mock.calls.filter(([url]) => url === "/api/str/estimate")).toHaveLength(1);
  });

  it("keeps unsaved estimate adjustments visible when saving fails", async () => {
    const { failures } = setup();
    clickTab("Estimate & evidence");
    await waitTab("Estimate & evidence");
    fireEvent.click(screen.getByRole("button", { name: "Fine-tune assumptions" }));
    fireEvent.change(screen.getByLabelText("Average daily rate · ADR ($)"), {
      target: { value: "400" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    failures.save = true;
    clickTab("Review & share");
    await screen.findByRole("alert");
    await waitTab("Estimate & evidence");
    fireEvent.click(screen.getByRole("button", { name: "Fine-tune assumptions" }));
    expect(
      screen.getByLabelText("Average daily rate · ADR ($)"),
    ).toHaveProperty("value", "400");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    failures.save = false;
    clickTab("Review & share");
    await waitTab("Review & share");
  });

  it("saves an appraisal value independently of the asking price without rerunning STR or copy", async () => {
    const { getListing, getReport, fetcher } = setup();
    const originalListing = structuredClone(getListing());
    clickTab("Property");
    await waitTab("Property");
    fireEvent.change(
      screen.getByLabelText("Estimated property value ($)"),
      { target: { value: "1400000" } },
    );
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Review estimate & evidence",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review estimate & evidence" }),
    );
    await waitTab("Estimate & evidence");
    expect(getListing()).toEqual(originalListing);
    expect(getReport().user_overrides_json?.strProperty?.propertyValue).toBe(1400000);
    expect(getReport().final_report_json?.property.estimated_value).toBe(1400000);
    expect(getReport().final_report_json?.str_yield?.price_midpoint).toBe(1400000);
    expect(fetcher.mock.calls.filter(([url]) => url === "/api/listings/mock-listing")).toHaveLength(0);
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
    clickTab("Property");
    await waitTab("Property");
    fireEvent.change(screen.getByLabelText("Guest capacity"), {
      target: { value: "6" },
    });
    await waitFor(() =>
      expect(
        (
          screen.getByRole("button", {
            name: "Review estimate & evidence",
          }) as HTMLButtonElement
        ).disabled,
      ).toBe(false),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Review estimate & evidence" }),
    );
    await waitTab("Estimate & evidence");
    expect(getListing().accommodates).toBe(6);
    expect(
      fetcher.mock.calls.filter(([url]) => url === "/api/str/estimate"),
    ).toHaveLength(1);
  });
});


describe("evidence before design safeguards", () => {
  it("has four ordered steps and locks design and delivery until their prerequisites exist", async () => {
    const { fetcher } = setup(true);
    expect(screen.getAllByRole("tab").map(tab => tab.textContent?.replace(/^\d/, ""))).toEqual([
      "Property", "Estimate & evidence", "Design & content", "Review & share",
    ]);
    await waitTab("Property");
    expect(screen.getByRole("tab", { name: "Design & content" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("tab", { name: "Review & share" }).getAttribute("aria-disabled")).toBe("true");
    expect(screen.queryByText("Choose your report design")).toBeNull();
    clickTab("Estimate & evidence");
    await waitTab("Estimate & evidence");
    expect(screen.getByRole("tab", { name: "Design & content" }).getAttribute("aria-disabled")).toBe("false");
    expect(fetcher.mock.calls.some(([url, init]) => url.endsWith("generate-copy") || (url === "/api/reports/mock-report" && init?.method === "PATCH" && JSON.parse(String(init.body)).template_id))).toBe(false);
  });

  it("shows saved estimates in the template previews before any copy is generated", async () => {
    const { getReport } = setup(true);
    fireEvent.click(screen.getByRole("button", { name: "Get estimate & evidence" }));
    await waitTab("Estimate & evidence");
    fireEvent.click(screen.getByRole("button", { name: "Fine-tune assumptions" }));
    fireEvent.change(screen.getByLabelText("Average daily rate · ADR ($)"), { target: { value: "400" } });
    fireEvent.change(screen.getByLabelText("Estimated occupancy (%)"), { target: { value: "75" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply changes" }));
    fireEvent.click(screen.getByRole("button", { name: "Use estimate & choose design" }));
    await waitTab("Design & content");
    expect(getReport().final_estimate_json?.annualRevenue).toBe(109500);
    expect(screen.getAllByTestId("preview-revenue").some(el => el.textContent === "109500")).toBe(true);
  });

  it("changes templates without another estimate or generation and preserves customised content and photos", async () => {
    const { getReport, fetcher, templates } = setup();
    clickTab("Design & content");
    await waitTab("Design & content");
    fireEvent.change(screen.getByLabelText("Heading"), { target: { value: "Personal customer headline" } });
    fireEvent.click(screen.getByRole("button", { name: "Type before debounce" }));
    fireEvent.click(screen.getByRole("button", { name: "Change cover photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Choose new photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Change report design" }));
    await screen.findByText("Choose your report design");
    const estimate = getReport().final_estimate_json;
    const evidence = getReport().str_enrichment_json;
    const next = templates.find(t => t.id !== getReport().template_id)!;
    fireEvent.click(screen.getByRole("button", { name: new RegExp(next.label) }));
    fireEvent.click(screen.getByRole("button", { name: "Use design & edit content" }));
    await screen.findByLabelText("Heading");
    expect(getReport().template_id).toBe(next.id);
    expect(getReport().final_report_json?.template_id).toBe(next.id);
    expect(getReport().final_estimate_json).toEqual(estimate);
    expect(getReport().str_enrichment_json).toEqual(evidence);
    expect(getReport().final_report_json?.copy.heading).toBe("Personal customer headline");
    expect(getReport().final_report_json?.copy.blurb).toBe("Just typed description");
    expect(getReport().final_report_json?.property.hero_image_url).toBe("https://example.test/new-cover.jpg");
    expect(fetcher.mock.calls.some(([url]) => url === "/api/str/estimate" || url.endsWith("generate-copy"))).toBe(false);
  });

  it("keeps content visible if saving before a template change fails", async () => {
    const { failures } = setup();
    clickTab("Design & content");
    await waitTab("Design & content");
    fireEvent.change(screen.getByLabelText("Heading"), { target: { value: "Keep this wording" } });
    failures.save = true;
    fireEvent.click(screen.getByRole("button", { name: "Change report design" }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Heading")).toHaveProperty("value", "Keep this wording");
    expect(screen.queryByText("Choose your report design")).toBeNull();
    failures.save = false;
    fireEvent.click(screen.getByRole("button", { name: "Change report design" }));
    await screen.findByText("Choose your report design");
  });

  it("saves a template selection when returning to evidence without generating content", async () => {
    const { fetcher, getReport, templates } = setup(true);
    fireEvent.click(screen.getByRole("button", { name: "Get estimate & evidence" }));
    await waitTab("Estimate & evidence");
    clickTab("Design & content");
    await waitTab("Design & content");
    fireEvent.click(screen.getByRole("button", { name: new RegExp(templates[1].label) }));
    fireEvent.click(screen.getByRole("button", { name: "Back to evidence" }));
    await waitTab("Estimate & evidence");
    expect(getReport().template_id).toBe(templates[1].id);
    clickTab("Design & content");
    await waitTab("Design & content");
    expect(screen.getByRole("button", { name: new RegExp(templates[1].label) }).getAttribute("aria-pressed")).toBe("true");
    expect(fetcher.mock.calls.some(([url]) => url.endsWith("generate-copy"))).toBe(false);
  });

  it("requires evidence review after property changes even if the user clicks directly to delivery", async () => {
    const { fetcher } = setup();
    clickTab("Property");
    await waitTab("Property");
    fireEvent.change(screen.getByLabelText("Bedrooms"), { target: { value: "5" } });
    clickTab("Review & share");
    await waitTab("Estimate & evidence");
    expect(fetcher.mock.calls.filter(([url]) => url === "/api/str/estimate")).toHaveLength(1);
    expect(fetcher.mock.calls.some(([url]) => url.endsWith("generate-copy"))).toBe(false);
  });

  it("can estimate and return to evidence even when no templates are available", async () => {
    const { fetcher } = setup(true, { noTemplates: true });
    fireEvent.click(screen.getByRole("button", { name: "Get estimate & evidence" }));
    await waitTab("Estimate & evidence");
    clickTab("Design & content");
    await screen.findByText("No templates are available for your account.");
    expect(screen.getByRole("button", { name: "Use design & write report" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Back to evidence" }));
    await waitTab("Estimate & evidence");
    expect(fetcher.mock.calls.filter(([url]) => url === "/api/str/estimate")).toHaveLength(1);
  });

  it("resumes an estimated draft on evidence and a generated report on review", async () => {
    const { report } = createLintRegressionFixtures();
    const estimated = setup(true, { report: { final_estimate_json: report.final_estimate_json } });
    await waitTab("Estimate & evidence");
    estimated.unmount();
    setup();
    await waitTab("Review & share");
  });

  it("keeps older generated reports editable when only the original estimate is present", async () => {
    const { fetcher } = setup(false, { report: { final_estimate_json: null } });
    clickTab("Design & content");
    await waitTab("Design & content");
    expect(screen.getByLabelText("Heading")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Change report design" }));
    await screen.findByText("Choose your report design");
    expect(screen.getAllByTestId("preview-revenue").every(el => Boolean(el.textContent))).toBe(true);
    expect(fetcher.mock.calls.some(([url]) => url === "/api/str/estimate")).toBe(false);
  });

  it("holds navigation and delivery while customer details are being edited at review", async () => {
    const { fetcher } = setup(false, { customerEditing: true });
    expect(screen.getAllByRole("tab").every(tab => tab.getAttribute("aria-disabled") === "true")).toBe(true);
    // Inert also blocks the ready PDF / public-report anchors, beyond disabled buttons.
    expect(screen.getByText("Download PDF", { selector: "a" }).closest("[inert]")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Prepare again", hidden: true })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Publish online report", hidden: true }));
    expect(fetcher.mock.calls.some(([url]) => url.endsWith("publish"))).toBe(false);
    expect(screen.getByText("Archive").closest("[inert]")).toBeTruthy();
  });

  it("shows customer details only at review and keeps archive available on property", async () => {
    const { fetcher } = setup();
    expect(screen.getByText("Customer details panel")).toBeTruthy();
    clickTab("Property");
    await waitTab("Property");
    expect(screen.queryByText("Customer details panel")).toBeNull();
    expect(screen.getByRole("button", { name: "Archive" })).toBeTruthy();
    clickTab("Review & share");
    await waitTab("Review & share");
    expect(screen.getByText("Customer details panel")).toBeTruthy();
    expect(fetcher.mock.calls.some(([url]) => url === "/api/str/estimate")).toBe(false);
  });
});

it("saves rental and amenity changes per appraisal, preserves estimate overrides and restores them after returning", async () => {
  const saved = { nightlyRate: 450, occupancyRate: 70 };
  const { fetcher, getReport } = setup(false, { report: { user_overrides_json: { strAdjustment: saved } } });
  clickTab("Property");
  await waitTab("Property");
  fireEvent.change(screen.getByLabelText("Long-term rent ($ / week)"), { target: { value: "925" } });
  fireEvent.click(screen.getByRole("button", { name: "Pool" }));
  fireEvent.change(screen.getByLabelText("Add another amenity"), { target: { value: "Private tennis court" } });
  fireEvent.click(screen.getByRole("button", { name: "Review estimate & evidence" }));
  await waitTab("Estimate & evidence");
  expect(getReport().user_overrides_json?.strProperty).toMatchObject({ weeklyRent: 925, amenities: ["pool"], additionalAmenities: ["Private tennis court"] });
  expect(getReport().user_overrides_json?.strAdjustment).toEqual(saved);
  expect(getReport().final_report_json?.ltr.annual_midpoint).toBe(48100);
  clickTab("Property");
  await waitTab("Property");
  expect((screen.getByLabelText("Long-term rent ($ / week)") as HTMLInputElement).value).toBe("925");
  expect(screen.getByRole("button", { name: "Pool" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "Remove Private tennis court" })).toBeTruthy();
  expect(fetcher.mock.calls.filter(([url]) => url === "/api/str/estimate")).toHaveLength(0);
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith("generate-copy"))).toHaveLength(0);
});

it("saves parking to the property and report without another estimate, and restores it on return", async () => {
  const { fetcher, getListing, getReport } = setup();
  clickTab("Property");
  await waitTab("Property");
  fireEvent.change(screen.getByLabelText("Car spaces"), { target: { value: "0" } });
  clickTab("Review & share");
  await waitTab("Review & share");
  expect(getListing().car_spaces).toBe(0);
  expect(getReport().final_report_json?.property.car_spaces).toBe(0);
  expect(getReport().pdf_url).toBeNull();
  expect(fetcher.mock.calls.some(([url]) => url === "/api/str/estimate")).toBe(false);
  expect(fetcher.mock.calls.some(([url]) => url.endsWith("generate-copy"))).toBe(false);
  clickTab("Property");
  await waitTab("Property");
  expect(screen.getByLabelText("Car spaces")).toHaveProperty("value", "0");
});

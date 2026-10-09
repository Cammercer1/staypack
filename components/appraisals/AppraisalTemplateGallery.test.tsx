// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppraisalTemplateGallery } from "./AppraisalTemplateGallery";
vi.mock("@/components/reports/FittedReportPreview", () => ({
  FittedReportPreview: () => null,
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("selects the exact account template when two designs share a family", async () => {
  const templates = ["agency-one", "agency-two"].map((id) => ({
    id,
    label: id,
    family: "classic",
    pages: 2,
    scope: "agency",
  }));
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ templates, default_template_id: "agency-one" }),
      ),
  );
  const onChange = vi.fn();
  render(
    <AppraisalTemplateGallery
      product="lease"
      value="agency-one"
      onChange={onChange}
      onReady={vi.fn()}
      previewForTemplate={() => null}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: /agency-two/ }));
  expect(onChange).toHaveBeenLastCalledWith("agency-two");
});

it("recovers from a template-loading failure without reloading the wizard", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockRejectedValueOnce(new Error("Network unavailable"))
      .mockResolvedValueOnce(
        Response.json({
          templates: [{ id: "classic", label: "Classic", pages: 2 }],
          default_template_id: "classic",
        }),
      ),
  );
  render(
    <AppraisalTemplateGallery
      product="lease"
      value="classic"
      onChange={vi.fn()}
      onReady={vi.fn()}
      previewForTemplate={() => null}
    />,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
  expect(await screen.findByRole("button", { name: /Classic/ })).toBeTruthy();
});

it("shows server-loaded designs immediately without another request", () => {
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  render(
    <AppraisalTemplateGallery
      product="lease"
      value="classic"
      onChange={vi.fn()}
      onReady={vi.fn()}
      previewForTemplate={() => null}
      initialTemplates={{
        default_template_id: "classic",
        templates: [
          {
            id: "classic",
            label: "Classic",
            description: "Branded appraisal",
            product: "lease",
            scope: "platform",
            brand_mode: "agency",
            default_blurb_length: "short",
            pages: 2,
          },
        ],
      }}
    />,
  );
  expect(screen.getByRole("button", { name: /Classic/ })).toBeTruthy();
  expect(screen.queryByRole("status")).toBeNull();
  expect(fetcher).not.toHaveBeenCalled();
});

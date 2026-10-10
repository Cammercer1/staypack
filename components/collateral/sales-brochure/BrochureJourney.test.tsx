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
import { SalesBrochureWizard } from "./SalesBrochureWizard";
import { FittedBrochurePreview } from "./FittedBrochurePreview";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { getTemplatesForProduct } from "@/lib/templates/catalog";
import { serializeTemplateForApi } from "@/lib/templates/serializeForApi";
import type { CollateralItem } from "@/lib/types";
import type { BrochureDocumentJson } from "@/lib/collateral/templates/types";

vi.mock("./FittedBrochurePreview", () => ({
  FittedBrochurePreview: ({
    document,
    editable,
  }: ComponentProps<typeof FittedBrochurePreview>) => {
    if (!editable) return <><p>{document.copy.heading}</p><p>{document.copy.price_value || document.property.display_price}</p></>;
    if (editable.blurbFlushRef)
      editable.blurbFlushRef.current ??= () => editable.blurbBlocks;
    return (
      <>
        <button
          onClick={() =>
            editable.setField("copy.heading", "Reviewed brochure headline")
          }
        >
          Edit headline
        </button>
        <button
          onClick={() => {
            if (editable.blurbFlushRef)
              editable.blurbFlushRef.current = () => [
                { type: "paragraph", text: "Just typed description" },
              ];
          }}
        >
          Type before debounce
        </button>
        <button onClick={() => editable.openImagePicker("hero")}>
          Replace cover photo
        </button>
      </>
    );
  },
}));
vi.mock("./inline/BrochureImagePickerDialog", () => ({
  BrochureImagePickerDialog: ({
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
vi.mock("./BlurbVariantsEditor", () => ({ BlurbVariantsEditor: () => null }));
vi.mock("@/components/dev/BlurbLengthMappingPanel", () => ({
  BlurbLengthMappingPanel: () => null,
}));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

for (const type of ["sales_brochure", "rental_brochure"] as const) {
  function setup(draft = false, missingPrice = false, blankDocumentPrice = false) {
    const fixtures = createLintRegressionFixtures();
    fixtures.listing.advertised_sale_price = missingPrice ? null : "$2,450,000";
    fixtures.listing.advertised_weekly_rent = missingPrice ? null : "$850";
    const templates = getTemplatesForProduct(type)
      .filter((template) => template.scope === "platform")
      .map(serializeTemplateForApi);
    const document: BrochureDocumentJson =
      type === "rental_brochure"
        ? {
            ...fixtures.document,
            type,
            version: "rental_brochure_v1",
            template_id: templates[0].id,
          }
        : {
            ...fixtures.document,
            type,
            version: "sales_brochure_v1",
            template_id: templates[0].id,
          };
    if (blankDocumentPrice) {
      document.copy.price_value = "";
      document.property.display_price = "";
    }
    let collateral: Omit<CollateralItem, "document_json"> & {
      document_json: BrochureDocumentJson | null;
    } = {
      ...fixtures.collateral,
      type,
      document_json: draft ? null : document,
      template_id: draft ? null : document.template_id,
      pdf_url: null,
    };
    const failures = { save: false, generation: false, pdf: false };
    const fetcher = vi.fn<
      (url: string, init?: RequestInit) => Promise<Response>
    >(async (url, init) => {
      const body = init?.body ? JSON.parse(String(init.body)) : {};
      if (init?.method === "PATCH") {
        if (failures.save) throw new Error("Connection lost");
        collateral = {
          ...collateral,
          template_id: body.template_id ?? collateral.template_id,
          pdf_url: null,
          document_json: collateral.document_json
            ? {
                ...collateral.document_json,
                template_id:
                  body.template_id ?? collateral.document_json.template_id,
                copy: { ...collateral.document_json.copy, ...body.copy },
                property: {
                  ...collateral.document_json.property,
                  ...body.property,
                },
                content_saved_at: "2026-10-09T01:00:00Z",
              }
            : null,
        };
      } else if (url.endsWith("generate-copy")) {
        if (failures.generation)
          return Response.json({ error: "Writing failed" }, { status: 500 });
        collateral = {
          ...collateral,
          document_json: { ...document, copy: { ...document.copy, price_value: body.price_value ?? document.copy.price_value }, template_id: collateral.template_id! },
        };
      } else if (url.endsWith("generate-pdf")) {
        if (failures.pdf) throw new Error("PDF service unavailable");
        collateral = {
          ...collateral,
          pdf_url: "https://example.test/brochure.pdf",
          document_json: {
            ...collateral.document_json!,
            pdf_synced_at: collateral.document_json?.content_saved_at,
          },
        };
      } else if (url.endsWith("publish")) {
        collateral = {
          ...collateral,
          status: "published",
          public_url: "https://example.test/brochure",
        };
      }
      return Response.json({ collateral });
    });
    vi.stubGlobal("fetch", fetcher);
    render(
      <SalesBrochureWizard
        initialListing={fixtures.listing}
        initialCollateral={collateral}
        agency={fixtures.agency}
        initialAgencyAgents={[fixtures.agent]}
        collateralType={type}
        availableTemplates={{ templates, default_template_id: templates[0].id }}
      />,
    );
    return { fetcher, failures, getCollateral: () => collateral };
  }
  describe(`${type} journey`, () => {
    it("selects a two-page design, generates immediately, then prepares a private PDF", async () => {
      const { fetcher } = setup(true);
      fireEvent.click(screen.getByRole("button", { name: "2 pages" }));
      fireEvent.click(
        screen.getByRole("button", { name: "Use design & generate brochure" }),
      );
      await screen.findByRole("button", { name: "Review & download" });
      expect(
        fetcher.mock.calls.filter(([url]) => url.endsWith("generate-copy")),
      ).toHaveLength(1);
      expect(
        JSON.parse(String(fetcher.mock.calls[0][1]?.body)).template_id,
      ).toContain(
        type === "sales_brochure" ? "sales-brochure" : "rental-brochure",
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Review & download" }),
      );
      await screen.findByRole("button", { name: "Prepare PDF" });
      fireEvent.click(screen.getByRole("button", { name: "Prepare PDF" }));
      await screen.findByRole("link", { name: "Download PDF" });
      expect(fetcher.mock.calls.some(([url]) => url.endsWith("publish"))).toBe(
        false,
      );
      expect(screen.getByText("Private draft")).toBeTruthy();
      expect(
        fetcher.mock.calls.filter(([, init]) => init?.method === "PATCH"),
      ).toHaveLength(1);
    });
    it("saves text and photo changes before tab navigation and retains them on failed saves", async () => {
      const { failures, fetcher, getCollateral } = setup();
      fireEvent.click(screen.getByRole("tab", { name: "Edit brochure" }));
      await screen.findByRole("button", { name: "Edit headline" });
      fireEvent.click(screen.getByRole("button", { name: "Edit headline" }));
      fireEvent.click(
        screen.getByRole("button", { name: "Replace cover photo" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Choose new photo" }));
      failures.save = true;
      fireEvent.click(screen.getByRole("tab", { name: "Download & share" }));
      await screen.findByText(
        "Your changes couldn’t be saved. Try Save & preview again.",
      );
      expect(
        screen
          .getByRole("tab", { name: "Edit brochure" })
          .getAttribute("aria-selected"),
      ).toBe("true");
      failures.save = false;
      fireEvent.click(screen.getByRole("button", { name: "Save & preview" }));
      await screen.findByRole("button", { name: "Prepare PDF" });
      expect(getCollateral().document_json?.copy.heading).toBe(
        "Reviewed brochure headline",
      );
      expect(getCollateral().document_json?.property.hero_image_url).toBe(
        "https://example.test/new-cover.jpg",
      );
      expect(fetcher).toHaveBeenCalledTimes(2);
    });
    it("flushes just-typed content when continuing before debounce", async () => {
      const { getCollateral } = setup();
      fireEvent.click(screen.getByRole("tab", { name: "Edit brochure" }));
      fireEvent.click(
        await screen.findByRole("button", { name: "Type before debounce" }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Review & download" }),
      );
      await screen.findByRole("button", { name: "Prepare PDF" });
      expect(getCollateral().document_json?.copy.blurb).toBe(
        "Just typed description",
      );
    });
    it("retries failed PDF preparation and publishes without regenerating the PDF", async () => {
      const { failures, fetcher } = setup();
      failures.pdf = true;
      fireEvent.click(screen.getByRole("button", { name: "Prepare PDF" }));
      await screen.findByText("PDF service unavailable");
      failures.pdf = false;
      fireEvent.click(screen.getByRole("button", { name: "Prepare PDF" }));
      await screen.findByRole("link", { name: "Download PDF" });
      fireEvent.click(
        screen.getByRole("button", { name: "Publish online brochure" }),
      );
      await screen.findByText("Published online");
      expect(
        fetcher.mock.calls.filter(([url]) => url.endsWith("generate-pdf")),
      ).toHaveLength(2);
      expect(
        fetcher.mock.calls.filter(([url]) => url.endsWith("publish")),
      ).toHaveLength(1);
    });
    it("recovers from generation failure without losing the selected design", async () => {
      const { failures, fetcher } = setup(true);
      failures.generation = true;
      fireEvent.click(
        screen.getByRole("button", { name: "Use design & generate brochure" }),
      );
      await screen.findByText(/Writing failed/);
      failures.generation = false;
      expect((screen.getByRole("textbox", { name: type === "rental_brochure" ? "Weekly rent" : "Sale price or guide" }) as HTMLInputElement).value).toBe(type === "rental_brochure" ? "$850 per week" : "$2,450,000");
      fireEvent.click(screen.getByRole("button", { name: "Use design & generate brochure" }));
      await screen.findByRole("button", { name: "Review & download" });
      expect(
        fetcher.mock.calls.filter(([, init]) => init?.method === "PATCH"),
      ).toHaveLength(1);
    });
    it("invalidates the old PDF download after an edit is saved", async () => {
      setup();
      fireEvent.click(screen.getByRole("button", { name: "Prepare PDF" }));
      await screen.findByRole("link", { name: "Download PDF" });
      fireEvent.click(screen.getByRole("tab", { name: "Edit brochure" }));
      fireEvent.click(
        await screen.findByRole("button", { name: "Edit headline" }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Save & preview" }));
      await waitFor(() =>
        expect(screen.queryByRole("link", { name: "Download PDF" })).toBeNull(),
      );
      expect(screen.getByRole("button", { name: "Prepare PDF" })).toBeTruthy();
    });
    it("prompts for a missing price before generation and passes it through to the document", async () => {
      const { fetcher, getCollateral } = setup(true, true);
      expect(screen.getByRole("tab", { name: "Edit brochure" }).getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(screen.getByRole("button", { name: "Use design & generate brochure" }));
      await screen.findByText("Enter a price or choose Contact agent before continuing.");
      expect(fetcher).not.toHaveBeenCalled();
      const input = screen.getByRole("textbox", { name: type === "rental_brochure" ? "Weekly rent" : "Sale price or guide" });
      fireEvent.change(input, { target: { value: type === "rental_brochure" ? "975" : "$1,250,000" } });
      const expected = type === "rental_brochure" ? "$975 per week" : "$1,250,000";
      expect(screen.getAllByText(expected).length).toBeGreaterThan(0);
      fireEvent.click(screen.getByRole("button", { name: "Use design & generate brochure" }));
      await screen.findByRole("button", { name: "Review & download" });
      expect(getCollateral().document_json?.copy.price_value).toBe(expected);
    });
    it("lets the user explicitly choose Contact agent without inventing an amount", async () => {
      const { getCollateral } = setup(true, true);
      fireEvent.click(screen.getByRole("button", { name: "Use “Contact agent”" }));
      fireEvent.click(screen.getByRole("button", { name: "Use design & generate brochure" }));
      await screen.findByRole("button", { name: "Review & download" });
      expect(getCollateral().document_json?.copy.price_value).toBe("Contact Agent");
    });
    it("opens old blank-price brochures on Design and saves the advertised price without rewriting", async () => {
      const { getCollateral, fetcher } = setup(false, false, true);
      expect(
        screen.getByRole("tab", { name: "Design" }).getAttribute("aria-selected"),
      ).toBe("true");
      fireEvent.click(
        screen.getByRole("button", { name: "Use design & edit brochure" }),
      );
      await screen.findByRole("button", { name: "Review & download" });
      expect(getCollateral().document_json?.copy.price_value).toBe(
        type === "rental_brochure" ? "$850 per week" : "$2,450,000",
      );
      expect(fetcher.mock.calls.some(([url]) => url.endsWith("generate-copy"))).toBe(false);
    });
    it("saves price changes to an existing brochure without rewriting its content", async () => {
      const { getCollateral, fetcher } = setup();
      fireEvent.click(screen.getByRole("tab", { name: "Design" }));
      fireEvent.change(screen.getByRole("textbox", { name: type === "rental_brochure" ? "Weekly rent" : "Sale price or guide" }), { target: { value: type === "rental_brochure" ? "$995 per week" : "$1,300,000" } });
      fireEvent.click(screen.getByRole("button", { name: "Use design & edit brochure" }));
      await screen.findByRole("button", { name: "Review & download" });
      expect(getCollateral().document_json?.copy.price_value).toBe(type === "rental_brochure" ? "$995 per week" : "$1,300,000");
      expect(fetcher.mock.calls.some(([url]) => url.endsWith("generate-copy"))).toBe(false);
    });
  });
}

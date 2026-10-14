// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { buildSocialPostsDocument } from "@/lib/collateral/buildSocialPostsDocument";
import { SocialPostsEditor } from "./SocialPostsEditor";
import type { CollateralItem } from "@/lib/types";
import type { SocialPostsDocumentJson } from "@/lib/collateral/templates/types";

vi.mock("@/components/properties/PropertyContext", () => ({
  CreateAnother: () => <span>Create another</span>,
  PropertyContext: () => <span>Property</span>,
}));
vi.mock("@/components/listings/UnsavedListingGuard", () => ({
  UnsavedListingGuard: ({ dirty }: { dirty: boolean }) => (
    <span data-testid="dirty">{String(dirty)}</span>
  ),
}));
vi.mock("./SocialPostPreviewStage", () => ({
  SocialPostPreviewStage: () => <span>Preview</span>,
}));
vi.mock("./SocialPostExportCapture", () => ({
  SocialPostExportCapture: () => <div>Capture</div>,
}));
vi.mock("./SocialPostLayerPanel", () => ({
  SocialPostLayerPanel: ({
    document,
    onChange,
  }: {
    document: SocialPostsDocumentJson;
    onChange: (doc: SocialPostsDocumentJson) => void;
  }) => (
    <button
      onClick={() =>
        onChange({ ...document, listing: { ...document.listing, bedrooms: 7 } })
      }
    >
      Edit design
    </button>
  ),
}));
vi.mock("@/lib/collateral/social/captureSocialPostPng", () => ({
  waitForSocialPostExportCanvas: vi.fn(async () => ({})),
  captureSocialPostPng: vi.fn(async () =>
    Object.assign(new Blob(["png"], { type: "image/png" }), {
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    }),
  ),
}));
const fixture = createLintRegressionFixtures();
let record: CollateralItem;
let patchCount = 0;
let attempted: string[];
let failVariant = "";
let failSave = false;
beforeEach(() => {
  const item = { ...fixture.collateral, type: "social_posts" as const };
  record = {
    ...item,
    document_json: buildSocialPostsDocument({
      agency: fixture.agency,
      listing: fixture.listing,
      collateral: item,
      agencyAgents: [fixture.agent],
    }),
  };
  patchCount = 0;
  attempted = [];
  failVariant = "";
  failSave = false;
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  URL.createObjectURL = vi.fn(() => "blob:test");
  URL.revokeObjectURL = vi.fn();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init: RequestInit) => {
      const document = record.document_json as SocialPostsDocumentJson;
      if (init.method === "PATCH") {
        patchCount++;
        if (failSave)
          return Response.json({ error: "Save failed" }, { status: 503 });
        const patch = JSON.parse(init.body as string);
        record = {
          ...record,
          document_json: {
            ...document,
            ...patch,
            listing: { ...document.listing, ...patch.listing },
          },
        };
        return Response.json({ collateral: record });
      }
      const variant = String((init.body as FormData).get("variant"));
      attempted.push(variant);
      if (variant === failVariant) {
        failVariant = "";
        return Response.json({ error: "Upload interrupted" }, { status: 503 });
      }
      record = {
        ...record,
        document_json: {
          ...document,
          exports: {
            ...document.exports,
            [variant]: {
              png_url: `https://example.com/${variant}.png`,
              exported_at: new Date().toISOString(),
            },
          },
        },
      };
      return Response.json({ collateral: record });
    }),
  );
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("saves once and retains every format when downloading all", async () => {
  render(
    <SocialPostsEditor
      listing={fixture.listing}
      agency={fixture.agency}
      collateral={record}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "More post actions" }));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Download all 3 formats" }),
  );
  await screen.findByText("3 images downloaded in one ZIP.");
  expect(patchCount).toBe(1);
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  expect(attempted).toEqual(["square", "wide", "story"]);
  expect(
    Object.keys(
      (record.document_json as SocialPostsDocumentJson).exports ?? {},
    ),
  ).toEqual(expect.arrayContaining(["square", "wide", "story"]));
  expect(screen.getByTestId("dirty").textContent).toBe("false");
});
it("retries only remaining formats after a partial failure", async () => {
  failVariant = "wide";
  render(
    <SocialPostsEditor
      listing={fixture.listing}
      agency={fixture.agency}
      collateral={record}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "More post actions" }));
  fireEvent.click(
    await screen.findByRole("menuitem", { name: "Download all 3 formats" }),
  );
  await screen.findByText("Upload interrupted");
  expect(
    screen.getByText("1 image prepared. Retry to finish your download."),
  ).toBeTruthy();
  expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole("button", { name: "Retry remaining downloads" }),
  );
  await screen.findByText("3 images downloaded in one ZIP.");
  expect(attempted).toEqual(["square", "wide", "wide", "story"]);
  expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  expect(
    (record.document_json as SocialPostsDocumentJson).exports?.square?.png_url,
  ).toBe("https://example.com/square.png");
});
it("keeps unsaved edits and blocks export if saving fails", async () => {
  failSave = true;
  render(
    <SocialPostsEditor
      listing={fixture.listing}
      agency={fixture.agency}
      collateral={record}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Edit design" }));
  expect(screen.getByTestId("dirty").textContent).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Download post" }));
  await screen.findByText("Save failed");
  expect(attempted).toEqual([]);
  expect(screen.getByTestId("dirty").textContent).toBe("true");
  failSave = false;
  fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
  await waitFor(() =>
    expect(screen.getByTestId("dirty").textContent).toBe("false"),
  );
  expect(
    (record.document_json as SocialPostsDocumentJson).listing.bedrooms,
  ).toBe(7);
});

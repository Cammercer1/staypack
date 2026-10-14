// @vitest-environment jsdom
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { buildSocialPostsDocument } from "@/lib/collateral/buildSocialPostsDocument";
import { SocialPostsEditor } from "./SocialPostsEditor";
import type { SocialPostsDocumentJson } from "@/lib/collateral/templates/types";

vi.mock("@/components/properties/PropertyContext", () => ({
  CreateAnother: () => <span>Create another</span>,
  PropertyContext: () => <span>Property</span>,
}));
vi.mock("./SocialPostPreviewStage", async () => {
  const { SocialPostFormatPicker } = await import("./SocialPostFormatPicker");
  return {
    SocialPostPreviewStage: (
      props: Parameters<typeof SocialPostFormatPicker>[0],
    ) => <SocialPostFormatPicker {...props} />,
  };
});
vi.mock("./SocialPostExportCapture", () => ({
  SocialPostExportCapture: () => <div />,
}));
vi.mock("@/lib/collateral/social/captureSocialPostPng", () => ({
  waitForSocialPostExportCanvas: vi.fn().mockResolvedValue(null),
  captureSocialPostPng: vi
    .fn()
    .mockResolvedValue(new Blob(["png"], { type: "image/png" })),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup() {
  const fixtures = createLintRegressionFixtures();
  const item = {
    ...fixtures.collateral,
    type: "social_posts" as const,
    template_id: null,
  };
  const document = buildSocialPostsDocument({
    ...fixtures,
    collateral: item,
    agentProfile: fixtures.agent,
  });
  const collateral = { ...item, document_json: document };
  render(
    <SocialPostsEditor
      listing={fixtures.listing}
      agency={fixtures.agency}
      collateral={collateral}
    />,
  );
  return { collateral, document };
}

function editHeadline(text: string) {
  fireEvent.click(screen.getByRole("tab", { name: "Wording" }));
  fireEvent.change(screen.getByLabelText("Headline text"), {
    target: { value: text },
  });
}

describe("social post editor", () => {
  it("keeps switching formats clean and supports undo/redo of shared wording", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: "Story" }));
    expect(screen.getByRole("status").textContent).toBe("All changes saved");
    editHeadline("Open home Saturday");
    expect(screen.getByRole("status").textContent).toBe("Unsaved changes");
    fireEvent.click(screen.getByRole("button", { name: "Square" }));
    expect(
      (screen.getByLabelText("Headline text") as HTMLInputElement).value,
    ).toBe("Open home Saturday");
    fireEvent.click(screen.getByRole("button", { name: "Undo last edit" }));
    expect(screen.getByRole("status").textContent).toBe("All changes saved");
    fireEvent.click(screen.getByRole("button", { name: "Redo edit" }));
    expect(
      (screen.getByLabelText("Headline text") as HTMLInputElement).value,
    ).toBe("Open home Saturday");
  });

  it("retains edits on save failure and lets the agent retry", async () => {
    const { collateral, document } = setup();
    editHeadline("Just listed");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ error: "Connection lost" }, { status: 503 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await screen.findByRole("alert");
    expect(screen.getByRole("alert").textContent).toContain(
      "Your edits are still here",
    );
    expect(
      (screen.getByLabelText("Headline text") as HTMLInputElement).value,
    ).toBe("Just listed");
    fetchMock.mockImplementationOnce(async (_url, init) => {
      const patch = JSON.parse(init.body);
      return Response.json({
        collateral: {
          ...collateral,
          document_json: {
            ...document,
            ...patch,
            listing: { ...document.listing, ...patch.listing },
          },
        },
      });
    });
    fireEvent.click(screen.getByRole("button", { name: "Try saving again" }));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("All changes saved"),
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("locks editing during save so a late response cannot overwrite newer typing", async () => {
    const { collateral, document } = setup();
    let finish!: (response: Response) => void;
    let savedDocument: SocialPostsDocumentJson;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url, init) => {
        const patch = JSON.parse(init.body);
        savedDocument = {
          ...document,
          ...patch,
          listing: { ...document.listing, ...patch.listing },
        };
        return new Promise<Response>((resolve) => {
          finish = resolve;
        });
      }),
    );
    editHeadline("For sale");
    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(
      screen
        .getByRole("group", { name: "Social post editor" })
        .hasAttribute("disabled"),
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Download post",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    await act(async () =>
      finish(
        Response.json({
          collateral: { ...collateral, document_json: savedDocument },
        }),
      ),
    );
    expect(screen.getByRole("status").textContent).toBe("All changes saved");
    expect(
      (screen.getByLabelText("Headline text") as HTMLInputElement).value,
    ).toBe("For sale");
  });
});

// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import Link from "next/link";
import { BrandSettingsForm } from "./BrandSettingsForm";
import { DEFAULT_BRAND_VALUES } from "@/lib/branding/normalize";
import type { Agency } from "@/lib/types";

vi.mock("./BrandPreviewCard", () => ({
  BrandPreviewCard: () => <div>Report preview</div>,
}));
vi.mock("@/components/collateral/sales-brochure/FittedBrochurePreview", () => ({
  FittedBrochurePreview: () => <div>Brochure preview</div>,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
const agency = {
  ...DEFAULT_BRAND_VALUES,
  id: "agency-1",
  name: "Sample Agency",
  slug: "sample-agency",
  website_url: "",
  email: "",
  phone: "",
  logo_url: "https://example.com/original.svg",
  logo_dark_url: "https://example.com/original.svg",
  default_report_title: "Rental potential",
  default_cta: "Contact the agent",
  default_disclaimer: "",
  brand_advanced_json: {},
} as Agency;
const fetchMock = vi.fn();
const saveButton = () =>
  screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement;
const tab = (name: string) =>
  fireEvent.click(screen.getByRole("tab", { name }));
const changeName = (value: string) => {
  fireEvent.change(screen.getByLabelText("Agency name"), { target: { value } });
};
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("CSS", {
    supports: (_property: string, value: string) => value !== "bad-colour",
  });
  fetchMock.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it("marks colour changes dirty, preserves them across sections, and discards to the saved baseline", () => {
  render(<BrandSettingsForm agency={agency} />);
  expect(saveButton().disabled).toBe(true);
  tab("Colours");
  fireEvent.change(screen.getByLabelText("Text colour"), {
    target: { value: "#225544" },
  });
  expect(saveButton().disabled).toBe(false);
  tab("Logo");
  tab("Colours");
  expect((screen.getByLabelText("Text colour") as HTMLInputElement).value).toBe(
    "#225544",
  );
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  expect((screen.getByLabelText("Text colour") as HTMLInputElement).value).toBe(
    agency.text_colour,
  );
  expect(saveButton().disabled).toBe(true);
});

it("focuses agency validation errors without sending a request", async () => {
  render(<BrandSettingsForm agency={agency} mode="details" />);
  changeName("");
  fireEvent.click(saveButton());
  await screen.findByText("Agency name is required");
  expect(
    screen.getByLabelText("Agency name").getAttribute("aria-invalid"),
  ).toBe("true");
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByLabelText("Agency name")),
  );
  expect(fetchMock).not.toHaveBeenCalled();
});

it("rejects invalid colours and accepts legacy named colours", async () => {
  render(<BrandSettingsForm agency={agency} />);
  tab("Colours");
  fireEvent.change(screen.getByLabelText("Text colour"), {
    target: { value: "bad-colour" },
  });
  fireEvent.click(saveButton());
  await screen.findByText("Enter a valid colour, such as #095b42.");
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Text colour"), {
    target: { value: "white" },
  });
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ agency: { ...agency, text_colour: "white" } }),
  });
  fireEvent.click(saveButton());
  await waitFor(() => expect(saveButton().disabled).toBe(true));
  expect(fetchMock).toHaveBeenCalledOnce();
});

it("resets dirty state to the server's normalized values after save, and discards later edits to that new baseline", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      agency: {
        ...agency,
        name: "New Agency",
        website_url: "https://example.com",
      },
    }),
  });
  render(<BrandSettingsForm agency={agency} mode="details" />);
  changeName("New Agency");
  fireEvent.change(screen.getByLabelText(/Website/), {
    target: { value: "example.com" },
  });
  fireEvent.click(saveButton());
  await waitFor(() => expect(saveButton().disabled).toBe(true));
  expect((screen.getByLabelText(/Website/) as HTMLInputElement).value).toBe(
    "https://example.com",
  );
  changeName("Another name");
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  expect((screen.getByLabelText("Agency name") as HTMLInputElement).value).toBe(
    "New Agency",
  );
});

it.each(["network", "non-json", "server"])(
  "retains the draft and allows retry after a %s failure",
  async (kind) => {
    if (kind === "network")
      fetchMock.mockRejectedValueOnce(new Error("Connection lost"));
    else
      fetchMock.mockResolvedValueOnce({
        ok: false,
        json: async () => {
          if (kind === "non-json") throw new Error("Bad JSON");
          return { error: "This link name is already taken." };
        },
      });
    render(<BrandSettingsForm agency={agency} mode="details" />);
    changeName("Retry Agency");
    fireEvent.click(saveButton());
    await screen.findByRole("alert");
    expect(saveButton().disabled).toBe(false);
    expect(
      (screen.getByLabelText("Agency name") as HTMLInputElement).value,
    ).toBe("Retry Agency");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ agency: { ...agency, name: "Retry Agency" } }),
    });
    fireEvent.click(saveButton());
    await waitFor(() => expect(saveButton().disabled).toBe(true));
    expect(screen.queryByRole("alert")).toBeNull();
  },
);

it("holds edits and navigation while saving", async () => {
  let finish!: (value: unknown) => void;
  fetchMock.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  render(<BrandSettingsForm agency={agency} mode="details" />);
  changeName("Pending");
  fireEvent.click(saveButton());
  await screen.findByRole("button", { name: "Saving…" });
  expect(
    (
      screen
        .getByLabelText("Agency name")
        .closest("fieldset") as HTMLFieldSetElement
    ).disabled,
  ).toBe(true);
  expect(
    (
      screen.getByRole("button", {
        name: "Discard",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(true);
  finish({
    ok: true,
    json: async () => ({ agency: { ...agency, name: "Pending" } }),
  });
  await waitFor(() => expect(saveButton().disabled).toBe(true));
});

it("supports keyboard section navigation and warns before abandoning a draft", async () => {
  render(
    <>
      <Link href="/dashboard">Dashboard test link</Link>
      <BrandSettingsForm agency={agency} />
    </>,
  );
  fireEvent.keyDown(screen.getByRole("tab", { name: "Logo" }), { key: "End" });
  expect(document.activeElement).toBe(
    screen.getByRole("tab", { name: "Fonts" }),
  );
  tab("Colours");
  fireEvent.change(screen.getByLabelText("Text colour"), {
    target: { value: "#225544" },
  });
  fireEvent.click(screen.getByRole("link", { name: "Dashboard test link" }));
  await screen.findByRole("dialog", { name: "Leave without saving?" });
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect((screen.getByLabelText("Text colour") as HTMLInputElement).value).toBe(
    "#225544",
  );
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  const cleanEvent = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(cleanEvent);
  expect(cleanEvent.defaultPrevented).toBe(false);
});

it("keeps logo removal a draft until saved and restores it on discard", () => {
  render(<BrandSettingsForm agency={agency} />);
  fireEvent.click(screen.getByRole("button", { name: "Remove main logo" }));
  expect(screen.queryByAltText("Main logo preview")).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  expect(screen.getByAltText("Main logo preview").getAttribute("src")).toBe(
    agency.logo_url,
  );
});

it("separates agency fields from branding and sends only agency details", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ agency: { ...agency, name: "New name" } }),
  });
  const { unmount } = render(
    <BrandSettingsForm agency={agency} mode="details" />,
  );
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(screen.queryByText("Report defaults")).toBeNull();
  expect(screen.queryByRole("button", { name: "Preview" })).toBeNull();
  changeName("New name");
  fireEvent.click(saveButton());
  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(Object.keys(body).sort()).toEqual(
    [
      "email",
      "name",
      "phone",
      "settings_section",
      "slug",
      "website_url",
    ].sort(),
  );
  expect(body.settings_section).toBe("details");
  await waitFor(() => expect(saveButton().disabled).toBe(true));
  unmount();
  render(<BrandSettingsForm agency={agency} />);
  expect(screen.queryByLabelText("Agency name")).toBeNull();
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
    "Logo",
    "Colours",
    "Fonts",
  ]);
  expect(screen.getByText("Report defaults")).toBeTruthy();
});

it("saves report defaults with branding without submitting agency identity", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      agency: { ...agency, default_report_title: "New report title" },
    }),
  });
  render(<BrandSettingsForm agency={agency} />);
  fireEvent.click(screen.getByText("Report defaults"));
  fireEvent.change(screen.getByLabelText("Default report title"), {
    target: { value: "New report title" },
  });
  fireEvent.click(saveButton());
  await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.settings_section).toBe("brand");
  expect(body.default_report_title).toBe("New report title");
  for (const key of ["name", "email", "phone", "slug", "website_url"])
    expect(body).not.toHaveProperty(key);
  await waitFor(() => expect(saveButton().disabled).toBe(true));
});

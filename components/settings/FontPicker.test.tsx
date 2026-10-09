// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useForm } from "react-hook-form";
import { FontPicker } from "./FontPicker";
import { AgencyLogoUploader } from "./AgencyLogoUploader";
import type { AgencyInput } from "@/lib/validation/schemas";
const fetchMock = vi.fn();
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function Fonts({
  custom = false,
  onBusy = vi.fn(),
}: {
  custom?: boolean;
  onBusy?: (busy: boolean) => void;
}) {
  const form = useForm<AgencyInput>({
    defaultValues: {
      heading_font_family: "fraunces",
      body_font_family: "inter",
      heading_font_file_url: custom ? "old-heading" : "",
      body_font_file_url: custom ? "old-body" : "",
      font_file_url: custom ? "old-body" : "",
    },
  });
  return (
    <>
      <FontPicker form={form} onUploadStateChange={onBusy} />
      <output data-testid="values">{JSON.stringify(form.watch())}</output>
    </>
  );
}
it("searches and selects a font with the keyboard", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      fonts: [{ family: "Montserrat" }, { family: "Montserrat Alternates" }],
    }),
  });
  render(<Fonts />);
  const search = screen.getByRole("combobox", { name: "Search heading fonts" });
  fireEvent.change(search, { target: { value: "Mont" } });
  await screen.findByRole("option", { name: "Montserrat" });
  fireEvent.keyDown(search, { key: "ArrowDown" });
  expect(search.getAttribute("aria-activedescendant")).toBeTruthy();
  fireEvent.keyDown(search, { key: "Enter" });
  expect(
    JSON.parse(screen.getByTestId("values").textContent!).heading_font_family,
  ).toBe("Montserrat");
  expect(screen.queryByRole("listbox")).toBeNull();
});
it("starts at the last search result with ArrowUp and closes on Escape", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      fonts: [{ family: "Montserrat" }, { family: "Montserrat Alternates" }],
    }),
  });
  render(<Fonts />);
  const search = screen.getByRole("combobox", { name: "Search heading fonts" });
  fireEvent.change(search, { target: { value: "Mont" } });
  const last = await screen.findByRole("option", {
    name: "Montserrat Alternates",
  });
  fireEvent.keyDown(search, { key: "ArrowUp" });
  expect(search.getAttribute("aria-activedescendant")).toBe(last.id);
  fireEvent.keyDown(search, { key: "Escape" });
  expect(screen.queryByRole("listbox")).toBeNull();
});
it("shows search errors and still permits a popular font", async () => {
  fetchMock.mockRejectedValue(new Error("Offline"));
  render(<Fonts />);
  fireEvent.change(
    screen.getByRole("combobox", { name: "Search heading fonts" }),
    { target: { value: "Missing" } },
  );
  await screen.findAllByText(
    "Font search is unavailable. Try again or choose a popular font.",
  );
  fireEvent.click(screen.getByRole("button", { name: "Playfair Display" }));
  expect(
    JSON.parse(screen.getByTestId("values").textContent!).heading_font_family,
  ).toBe("playfair-display");
});
it("removes both the current and legacy custom body font when choosing a Google font", () => {
  render(<Fonts custom />);
  fireEvent.click(screen.getByRole("button", { name: "Inter" }));
  const values = JSON.parse(screen.getByTestId("values").textContent!);
  expect(values.body_font_file_url).toBe("");
  expect(values.font_file_url).toBe("");
  expect(values.heading_font_file_url).toBe("old-heading");
});
it("recovers after a failed custom font upload and supports retrying the same file", async () => {
  const onBusy = vi.fn();
  fetchMock.mockRejectedValueOnce(new Error("Offline"));
  render(<Fonts onBusy={onBusy} />);
  const input = screen.getByLabelText(
    "Upload heading font",
  ) as HTMLInputElement;
  const file = new File(["font"], "agency.woff2", { type: "font/woff2" });
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByRole("alert");
  expect(onBusy.mock.calls).toEqual([[true], [false]]);
  expect(input.disabled).toBe(false);
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ url: "https://example.com/new-font.woff2" }),
  });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() =>
    expect(
      JSON.parse(screen.getByTestId("values").textContent!)
        .heading_font_file_url,
    ).toBe("https://example.com/new-font.woff2"),
  );
  expect(screen.queryByRole("alert")).toBeNull();
});
it("keeps the existing logo after an upload failure, releases busy state, then retries", async () => {
  const change = vi.fn();
  const busy = vi.fn();
  fetchMock.mockRejectedValueOnce(new Error("Offline"));
  render(
    <AgencyLogoUploader
      variant="dark"
      value="old-logo.svg"
      onChange={change}
      onUploadStateChange={busy}
    />,
  );
  const input = screen.getByLabelText("Main logo") as HTMLInputElement;
  const file = new File(["logo"], "agency.svg", { type: "image/svg+xml" });
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByRole("alert");
  expect(change).not.toHaveBeenCalled();
  expect(screen.getByAltText("Main logo preview").getAttribute("src")).toBe(
    "old-logo.svg",
  );
  expect(busy.mock.calls).toEqual([[true], [false]]);
  fetchMock.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ url: "new-logo.svg" }),
  });
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(change).toHaveBeenCalledWith("new-logo.svg"));
  expect(screen.queryByRole("alert")).toBeNull();
});

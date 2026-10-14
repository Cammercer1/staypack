// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StrCalculatorWidget } from "./StrCalculatorWidget";
import type { CalculatorBrand } from "@/lib/str-calculator/brand";
const brand: CalculatorBrand = { name: "Test Agency", logo: "", primary: "#095b42", onPrimary: "#ffffff", background: "#ffffff", text: "#172b26", surface: "#ffffff", heading_font_family: "fraunces", body_font_family: "inter", heading_font_file_url: null, body_font_file_url: null };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

async function fillJourney() {
  fireEvent.change(screen.getByLabelText("Property address"), { target: { value: "12 Test Street, Sydney NSW 2000" } });
  fireEvent.click(screen.getByRole("button", { name: "Increase bedrooms" }));
  fireEvent.click(screen.getByRole("button", { name: "Increase bathrooms" }));
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByLabelText("Email address");
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "owner@example.com" } });
}
it("requires valid steps and explicit consent, then previews without an estimate call", async () => {
  const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
  render(<StrCalculatorWidget brand={brand} country="AU" preview />);
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByText("Enter the full street address, suburb and postcode.");
  await fillJourney();
  expect(screen.queryByLabelText("Phone number (optional)")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "View sample estimate" }));
  await screen.findByText("Please agree before viewing your estimate.");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "View sample estimate" }));
  await screen.findByText("Your property’s STR potential.");
  expect(screen.getByText(/1.5 bathrooms, up to 6 guests/)).toBeTruthy();
  const progress = within(screen.getByRole("list", { name: "Calculator progress" })).getAllByRole("listitem");
  expect(progress[2].getAttribute("aria-current")).toBe("step");
  expect(progress[2].textContent).toContain("Estimate");
  expect(fetch).not.toHaveBeenCalled();
});

it("lets visitors skip the phone field when the account enables it", async () => {
  render(<StrCalculatorWidget brand={brand} country="AU" askPhone preview />);
  await fillJourney();
  expect(screen.getByLabelText("Phone number (optional)")).toBeTruthy();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "View sample estimate" }));
  await screen.findByText("Your property’s STR potential.");
});

it("validates optional phone numbers and includes a valid number in the lead submission", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Please try again." }) });
  vi.stubGlobal("fetch", fetch);
  render(<StrCalculatorWidget brand={brand} country="AU" askPhone token="test-token" />);
  await fillJourney();
  fireEvent.change(screen.getByLabelText("Phone number (optional)"), { target: { value: "abc" } });
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "View my estimate" }));
  await screen.findByText("Enter a valid phone number or leave it blank.");
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Phone number (optional)"), { target: { value: "+61 412 345 678" } });
  fireEvent.click(screen.getByRole("button", { name: "View my estimate" }));
  await screen.findByText("Please try again.");
  expect(JSON.parse(fetch.mock.calls[0][1].body).phone).toBe("+61 412 345 678");
});

it("loads Places suggestions in the compact field and waits for the selected address before continuing", async () => {
  vi.useFakeTimers();
  let complete!: (value: unknown) => void;
  const fetch = vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ suggestions: [{ placeId: "place", address: "1/24 Cliffbrook Parade, Clovelly NSW", mainText: "1/24 Cliffbrook Parade", secondaryText: "Clovelly NSW, Australia" }] }) })
    .mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  vi.stubGlobal("fetch", fetch);
  render(<StrCalculatorWidget brand={brand} country="AU" token="widget-token" />);
  const input = screen.getByRole("combobox", { name: "Property address" });
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "1/24 Cliffbrook" } });
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
  expect(fetch.mock.calls[0][0]).toBe("/api/str-calculator/widget-token/address-suggestions");
  expect(screen.getByRole("listbox")).toBeTruthy();
  expect(screen.getByText("Google Maps")).toBeTruthy();
  fireEvent.keyDown(input, { key: "ArrowDown" });
  await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
  expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => { complete({ ok: true, json: async () => ({ address: "1/24 Cliffbrook Parade, Clovelly NSW 2031" }) }); });
  expect((input as HTMLInputElement).value).toBe("1/24 Cliffbrook Parade, Clovelly NSW 2031");
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(JSON.parse(fetch.mock.calls[1][1].body).sessionToken).toBe(JSON.parse(fetch.mock.calls[0][1].body).sessionToken);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Continue" })); });
  expect(screen.getByLabelText("Email address")).toBeTruthy();
  expect(screen.getByText("1/24 Cliffbrook Parade, Clovelly NSW 2031")).toBeTruthy();
});
it("preserves property data when going back and keeps a retry's request ID", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Please try again." }) });
  vi.stubGlobal("fetch", fetch);
  render(<StrCalculatorWidget brand={brand} country="AU" token="test-token" />);
  await fillJourney();
  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByLabelText("Bedrooms").textContent).toBe("3");
  expect(screen.getByLabelText("Bathrooms").textContent).toBe("1.5");
  expect((screen.getByLabelText("Property address") as HTMLInputElement).value).toBe("12 Test Street, Sydney NSW 2000");
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByLabelText("Email address");
  expect((screen.getByLabelText("Email address") as HTMLInputElement).value).toBe("owner@example.com");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "View my estimate" }));
  await screen.findByText("Please try again.");
  fireEvent.click(screen.getByRole("button", { name: "View my estimate" }));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  const first = JSON.parse(fetch.mock.calls[0][1].body);
  expect(JSON.parse(fetch.mock.calls[1][1].body).requestId).toBe(first.requestId);
  expect(first).toMatchObject({ bedrooms: 3, bathrooms: 1.5, email: "owner@example.com", consent: true });
});

it("adjusts bathrooms in half steps within the provider limits, independently of bedrooms", () => {
  render(<StrCalculatorWidget brand={brand} country="AU" preview />);
  const decrease = screen.getByRole("button", { name: "Decrease bathrooms" });
  const increase = screen.getByRole("button", { name: "Increase bathrooms" });
  fireEvent.click(decrease);
  expect(screen.getByLabelText("Bathrooms").textContent).toBe("0.5");
  expect((decrease as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Increase bedrooms" }));
  expect(screen.getByLabelText("Bathrooms").textContent).toBe("0.5");
  for (let count = 0; count < 39; count++) fireEvent.click(increase);
  expect(screen.getByLabelText("Bathrooms").textContent).toBe("20");
  expect((increase as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByLabelText("Email address")).toBeNull();
});

it("keeps the bedroom counter between studio and ten without advancing the property step", () => {
  render(<StrCalculatorWidget brand={brand} country="AU" preview />);
  const decrease = screen.getByRole("button", { name: "Decrease bedrooms" });
  const increase = screen.getByRole("button", { name: "Increase bedrooms" });
  fireEvent.click(decrease);
  fireEvent.click(decrease);
  expect(screen.getByLabelText("Bedrooms").textContent).toBe("Studio");
  expect((decrease as HTMLButtonElement).disabled).toBe(true);
  for (let count = 0; count < 10; count++) fireEvent.click(increase);
  expect(screen.getByLabelText("Bedrooms").textContent).toBe("10");
  expect((increase as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByLabelText("Property address")).toBeTruthy();
  expect(screen.queryByLabelText("Email address")).toBeNull();
});

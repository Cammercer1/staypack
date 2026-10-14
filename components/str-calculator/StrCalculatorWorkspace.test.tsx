// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { StrCalculatorWorkspace } from "./StrCalculatorWorkspace";
import type { CalculatorBrand } from "@/lib/str-calculator/brand";

const navigation = vi.hoisted(() => ({ tab: "setup" as string | null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/marketing/str-calculator", useSearchParams: () => ({ get: (key: string) => key === "tab" ? navigation.tab : null }) }));
const brand: CalculatorBrand = { name: "Test Agency", logo: "", primary: "#095b42", onPrimary: "#ffffff", background: "#ffffff", text: "#172b26", surface: "#ffffff", heading_font_family: "fraunces", body_font_family: "inter", heading_font_file_url: null, body_font_file_url: null };
const widget = { id: "widget", public_token: "token", enabled: false, country: "AU" as const, ask_phone: false };
const props = { brand, initialWidget: widget, canManage: true, leads: [], total: 0, page: 1, baseUrl: "https://example.com", loadedAt: 0 };
beforeEach(() => { navigation.tab = "setup"; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("opens on leads with a direct route to setup for a new account", () => {
  navigation.tab = null;
  render(<StrCalculatorWorkspace {...props} initialWidget={null} />);
  expect(screen.getByRole("heading", { name: "Calculator leads" })).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Property address" })).toBeNull();
  expect(screen.getByRole("link", { name: "Leads 0" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Set up your calculator" }).getAttribute("href")).toBe("/marketing/str-calculator?tab=setup");
});

it("keeps lead pagination in navigation and separates the two views", () => {
  navigation.tab = null;
  const { rerender } = render(<StrCalculatorWorkspace {...props} page={2} total={60} />);
  expect(screen.getByRole("link", { name: "Embed & settings" }).getAttribute("href")).toBe("/marketing/str-calculator?tab=setup&page=2");
  expect(screen.getByRole("link", { name: "Next" }).getAttribute("href")).toBe("/marketing/str-calculator?page=3");
  navigation.tab = "setup";
  rerender(<StrCalculatorWorkspace {...props} page={2} total={60} />);
  expect(screen.getByRole("link", { name: "Leads 60" }).getAttribute("href")).toBe("/marketing/str-calculator?page=2");
  expect(screen.getByRole("link", { name: "Embed & settings" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByLabelText("Embed code")).toBeTruthy();
  expect(screen.queryByRole("heading", { name: "Calculator leads" })).toBeNull();
});

it("preserves unsaved settings when moving between views", () => {
  const { rerender } = render(<StrCalculatorWorkspace {...props} />);
  fireEvent.click(screen.getByRole("switch", { name: "Ask for phone number" }));
  navigation.tab = null;
  rerender(<StrCalculatorWorkspace {...props} />);
  navigation.tab = "setup";
  rerender(<StrCalculatorWorkspace {...props} />);
  expect((screen.getByRole("switch", { name: "Ask for phone number" }) as HTMLInputElement).checked).toBe(true);
  expect(screen.getByRole("button", { name: "Save settings" })).toBeTruthy();
});

it("previews the optional field and saves it without activating a paused calculator", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ widget: { ...widget, ask_phone: true } }) });
  vi.stubGlobal("fetch", fetch);
  render(<StrCalculatorWorkspace {...props} />);
  fireEvent.click(screen.getByRole("switch", { name: "Ask for phone number" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Property address" }), { target: { value: "12 Test Street, Sydney NSW 2000" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByLabelText("Phone number (optional)");
  fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
  await screen.findByText("Settings saved. Your calculator is paused.");
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ enabled: false, country: "AU", ask_phone: true });
  expect(screen.queryByRole("button", { name: "Save settings" })).toBeNull();
  fireEvent.click(screen.getByRole("switch", { name: "Ask for phone number" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Property address" }), { target: { value: "12 Test Street, Sydney NSW 2000" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByLabelText("Email address");
  expect(screen.queryByLabelText("Phone number (optional)")).toBeNull();
});

it("does not let ordinary members change the phone setting", () => {
  render(<StrCalculatorWorkspace {...props} canManage={false} />);
  expect((screen.getByRole("switch", { name: "Ask for phone number" }) as HTMLInputElement).disabled).toBe(true);
  expect(screen.queryByRole("button", { name: "Save settings" })).toBeNull();
});

it("can save the phone preference before first activating a calculator", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ widget: { ...widget, ask_phone: true } }) });
  vi.stubGlobal("fetch", fetch);
  render(<StrCalculatorWorkspace {...props} initialWidget={null} />);
  fireEvent.click(screen.getByRole("switch", { name: "Ask for phone number" }));
  fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
  await screen.findByText("Settings saved. Your calculator is paused.");
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ enabled: false, country: "AU", ask_phone: true });
});

it("keeps settings edits available when saving fails", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: "Couldn’t save calculator settings." }) }));
  render(<StrCalculatorWorkspace {...props} />);
  fireEvent.click(screen.getByRole("switch", { name: "Ask for phone number" }));
  fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
  await screen.findByRole("alert");
  expect((screen.getByRole("switch", { name: "Ask for phone number" }) as HTMLInputElement).checked).toBe(true);
  await waitFor(() => expect((screen.getByRole("button", { name: "Save settings" }) as HTMLButtonElement).disabled).toBe(false));
});

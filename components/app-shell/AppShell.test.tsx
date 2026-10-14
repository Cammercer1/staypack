// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

vi.mock("next/navigation", () => ({ usePathname: () => "/short-term-rentals/appraisals/test" }));
vi.mock("@/components/auth/LogoutButton", () => ({ LogoutButton: () => <button>Log out</button> }));
beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() });
});
afterEach(cleanup);

it("keeps the STR workspace discoverable and active from an appraisal", () => {
  render(<AppShell>Appraisal</AppShell>);
  const nav = screen.getByRole("navigation", { name: "Main navigation" });
  const link = within(nav).getByRole("link", { name: "Short-Term Rentals" });
  expect(link.getAttribute("href")).toBe("/short-term-rentals");
  expect(link.getAttribute("aria-current")).toBe("page");
  expect(within(nav).getByRole("link", { name: "Listings" }).getAttribute("href")).toBe("/listings");
});

it("includes STR in the mobile navigation too", async () => {
  render(<AppShell>Appraisal</AppShell>);
  fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  const dialog = await screen.findByRole("dialog", { name: "Workspace navigation" });
  expect(within(dialog).getByRole("link", { name: "Short-Term Rentals" }).getAttribute("href")).toBe("/short-term-rentals");
});

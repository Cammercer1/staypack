// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ProposalReveal } from "./ProposalReveal";

const brand = { name: "Property Providers", logoUrl: "https://example.com/client-logo.png", primary: "#1277a0", primaryText: "#ffffff" };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

it("keeps the client's logo and colour visible until the cover is ready, without a fixed minimum delay", async () => {
  let decoded!: () => void;
  vi.stubGlobal("Image", class { src = ""; decode = () => new Promise<void>(resolve => { decoded = resolve; }); });
  render(<ProposalReveal brand={brand} coverImage="https://example.com/cover.jpg"><button>View appraisal</button></ProposalReveal>);
  expect(screen.getByRole("status").style.backgroundColor).toBe("rgb(18, 119, 160)");
  expect(screen.getByRole("img", { name: brand.name }).getAttribute("src")).toBe(brand.logoUrl);
  expect(screen.queryByRole("button")).toBeNull();
  expect(document.body.textContent).not.toContain("StayPack");
  await act(async () => decoded());
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByRole("button").textContent).toBe("View appraisal");
});

it("reveals the report even if the cover fails to load", async () => {
  vi.stubGlobal("Image", class { src = ""; decode = () => Promise.reject(new Error("offline")); });
  await act(async () => { render(<ProposalReveal brand={brand} coverImage="https://example.com/cover.jpg"><p>Report content</p></ProposalReveal>); });
  expect(screen.queryByRole("status")).toBeNull();
});

it("does not trap a visitor indefinitely behind a stalled image", async () => {
  vi.useFakeTimers();
  vi.stubGlobal("Image", class { src = ""; decode = () => new Promise<void>(() => {}); });
  render(<ProposalReveal brand={brand} coverImage="https://example.com/cover.jpg"><p>Report content</p></ProposalReveal>);
  await act(async () => { vi.advanceTimersByTime(4000); });
  expect(screen.queryByRole("status")).toBeNull();
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ClientsDirectory } from "./ClientsDirectory";

const client = { id: "00000000-0000-4000-8000-000000000001", name: "Jordan Taylor", email: "jordan@example.com", phone: "0412345678", phone_e164: "+61412345678", archived_at: null, created_at: "2026-10-16T00:00:00Z", updated_at: "2026-10-16T00:00:00Z" };
vi.mock("@/components/listings/UnsavedListingGuard", () => ({ UnsavedListingGuard: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("opens a linked client, keeps report kinds correct and edits only the directory endpoint", async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (url, init) => {
    if (init?.method === "PATCH") return Response.json({ client: { ...client, name: "Jordan Smith" } });
    if (String(url).includes("?")) return Response.json({ clients: [client], total: 1, page: 1, pageSize: 30 });
    return Response.json({ client, reports: [{ id: "str-report", kind: "str", address: "12 Coast Street", status: "published" }, { id: "lease-report", kind: "lease", address: "12 Coast Street", status: "draft" }], reportsTotal: 2, leads: [], leadsTotal: 0 });
  });
  vi.stubGlobal("fetch", fetcher);
  render(<ClientsDirectory initialClientId={client.id} />);
  await screen.findByRole("dialog", { name: "Jordan Taylor" });
  const links = screen.getAllByRole("link", { name: /12 Coast Street/ });
  expect(links.map(link => link.getAttribute("href"))).toEqual(["/short-term-rentals/appraisals/str-report", "/appraisals/lease-report"]);
  fireEvent.click(screen.getByRole("button", { name: "Edit client" }));
  fireEvent.change(screen.getByLabelText("Client name"), { target: { value: "Jordan Smith" } });
  fireEvent.click(screen.getByRole("button", { name: "Save client" }));
  await waitFor(() => expect(fetcher.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true));
  const request = fetcher.mock.calls.find(([, init]) => init?.method === "PATCH")!;
  expect(request[0]).toBe(`/api/clients/${client.id}`);
  expect(JSON.parse(String(request[1]?.body))).toEqual({ name: "Jordan Smith", email: client.email, phone: client.phone, archived: false, expected_updated_at: client.updated_at });
});

it("retains new details when duplicate detection rejects saving and confirms unsaved dismissal", async () => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockImplementation(async (_url, init) => init?.method === "POST" ? Response.json({ error: "A client already uses this email." }, { status: 409 }) : Response.json({ clients: [], total: 0, page: 1, pageSize: 30 })));
  render(<ClientsDirectory />);
  fireEvent.click(screen.getByRole("button", { name: "Add client" }));
  fireEvent.change(screen.getByLabelText("Client name"), { target: { value: "Jordan Taylor" } });
  fireEvent.change(screen.getByLabelText("Email (optional)"), { target: { value: "jordan@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Save client" }));
  expect((await screen.findByRole("alert")).textContent).toContain("already uses this email");
  expect(screen.getByLabelText("Client name")).toHaveProperty("value", "Jordan Taylor");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.getByRole("dialog", { name: "Discard client changes?" })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.getByLabelText("Client name")).toHaveProperty("value", "Jordan Taylor");
});

it("searches email and pages results without leaving the directory", async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async url => Response.json({ clients: [client], total: 32, page: String(url).includes("page=2") ? 2 : 1, pageSize: 30 }));
  vi.stubGlobal("fetch", fetcher);
  render(<ClientsDirectory />);
  await screen.findByRole("button", { name: /Jordan Taylor/ });
  fireEvent.change(screen.getByRole("searchbox", { name: "Search clients" }), { target: { value: "jordan@example.com" } });
  await waitFor(() => expect(fetcher.mock.calls.some(([url]) => String(url).includes("q=jordan%40example.com"))).toBe(true));
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(fetcher.mock.calls.some(([url]) => String(url).includes("page=2"))).toBe(true));
});

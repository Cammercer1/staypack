// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { NewStrAppraisalFlow } from "./NewStrAppraisalFlow";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, useSearchParams: () => new URLSearchParams() }));
vi.mock("@/components/listings/NewListingFlow", () => ({ NewListingFlow: () => null }));
afterEach(() => { sessionStorage.clear(); cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("creates a general draft without asking for a customer or requesting an estimate", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ report: { id: "new-draft" } }));
  vi.stubGlobal("fetch", fetcher);
  render(<NewStrAppraisalFlow initialListing={createLintRegressionFixtures().listing} storageKey="test" />);
  expect(screen.queryByLabelText("Customer name")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Create appraisal" }));
  await waitFor(() => expect(router.push).toHaveBeenCalledWith("/short-term-rentals/appraisals/new-draft"));
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][0]).toBe("/api/str/appraisals");
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ listing_id: "mock-listing", recipient: { mode: "general", name: "", email: "", phone: "" } });
});

it("prevents duplicate clicks and reuses the request id after a failed creation", async () => {
  let reject: (error: Error) => void = () => {};
  const fetcher = vi.fn().mockImplementationOnce(() => new Promise((_resolve, rejectRequest) => { reject = rejectRequest; })).mockResolvedValueOnce(Response.json({ report: { id: "new-draft" } }));
  vi.stubGlobal("fetch", fetcher);
  render(<NewStrAppraisalFlow initialListing={createLintRegressionFixtures().listing} storageKey="test" />);
  const create = screen.getByRole("button", { name: "Create appraisal" });
  fireEvent.click(create); fireEvent.click(create);
  expect(fetcher).toHaveBeenCalledTimes(1);
  reject(new Error("Temporarily unavailable"));
  await screen.findByRole("alert");
  fireEvent.click(screen.getByRole("button", { name: "Create appraisal" }));
  await waitFor(() => expect(router.push).toHaveBeenCalled());
  expect(JSON.parse(fetcher.mock.calls[0][1].body).request_id).toBe(JSON.parse(fetcher.mock.calls[1][1].body).request_id);
});

it("reuses the pending creation request after refreshing and clears it on success", async () => {
  const fetcher = vi.fn().mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValueOnce(Response.json({ report: { id: "recovered-draft" } }));
  vi.stubGlobal("fetch", fetcher);
  const fixture = createLintRegressionFixtures().listing;
  const view = render(<NewStrAppraisalFlow initialListing={fixture} storageKey="refresh-test" kind="lease" />);
  fireEvent.click(screen.getByRole("button", { name: "Create appraisal" }));
  await screen.findByRole("alert");
  const requestId = JSON.parse(fetcher.mock.calls[0][1].body).request_id;
  view.unmount();
  render(<NewStrAppraisalFlow initialListing={fixture} storageKey="refresh-test" kind="lease" />);
  fireEvent.click(screen.getByRole("button", { name: "Create appraisal" }));
  await waitFor(() => expect(router.push).toHaveBeenCalled());
  expect(JSON.parse(fetcher.mock.calls[1][1].body).request_id).toBe(requestId);
  expect(sessionStorage.getItem(`refresh-test:appraisal-request:lease:${fixture.id}`)).toBeNull();
});

it.each(["str", "lease", "sales"] as const)("carries an explicit source client snapshot into a new %s report", async kind => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ report: { id: "new-draft" } }));
  vi.stubGlobal("fetch", fetcher);
  const recipient = { mode: "named" as const, contact_id: "00000000-0000-4000-8000-000000000001", name: "Jordan Taylor", email: "jordan@example.com", phone: "0412345678" };
  render(<NewStrAppraisalFlow kind={kind} initialRecipient={recipient} initialListing={createLintRegressionFixtures().listing} storageKey="source" />);
  expect(screen.getByText("Jordan Taylor")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Create appraisal" }));
  await waitFor(() => expect(router.push).toHaveBeenCalled());
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).toMatchObject({ kind, recipient });
  expect(fetcher).toHaveBeenCalledOnce();
});

it("blocks an old nameless lead until the client name is completed", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ report: { id: "new-draft" } }));
  vi.stubGlobal("fetch", fetcher);
  render(<NewStrAppraisalFlow initialRecipient={{ mode: "named", name: "", email: "jordan@example.com", phone: "" }} initialListing={createLintRegressionFixtures().listing} storageKey="old-lead" />);
  fireEvent.click(screen.getByRole("button", { name: "Create appraisal" }));
  await screen.findByText("Check the client details before creating the appraisal.");
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Client name"), { target: { value: "Jordan Taylor" } });
  fireEvent.click(screen.getByRole("button", { name: "Create appraisal" }));
  await waitFor(() => expect(router.push).toHaveBeenCalled());
  expect(JSON.parse(fetcher.mock.calls[0][1].body).recipient).toMatchObject({ name: "Jordan Taylor", email: "jordan@example.com" });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { NewStrAppraisalFlow } from "./NewStrAppraisalFlow";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/listings/NewListingFlow", () => ({ NewListingFlow: () => null }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

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

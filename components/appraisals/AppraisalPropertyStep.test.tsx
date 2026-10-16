// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppraisalPropertyStep } from "./AppraisalPropertyStep";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import type { WorkspaceAppraisal } from "@/lib/appraisals/workspaceTypes";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/digital-proposals/ProposalWorkspaceControls", () => ({ proposalFetch: mocks.fetch }));
beforeEach(() => mocks.fetch.mockReset());
afterEach(cleanup);
const fixture = createLintRegressionFixtures();
const appraisal: WorkspaceAppraisal = { ...fixture.appraisal, kind: "lease", inputs_json: { version: 1, listing: fixture.listing }, input_revision: 1, document_revision: 1, document_json: fixture.lease.final_report_json };

it("continues without rewriting untouched nullable property fields or invalidating reviewed evidence", async () => {
  const onContinue = vi.fn();
  render(<AppraisalPropertyStep listing={{ ...fixture.listing, listing_description: null }} appraisal={appraisal} onSaved={vi.fn()} onBusyChange={vi.fn()} onContinue={onContinue} />);
  fireEvent.click(screen.getByRole("button", { name: "Continue to evidence" }));
  await waitFor(() => expect(onContinue).toHaveBeenCalledOnce());
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it("still validates missing property details before continuing without changes", async () => {
  const onContinue = vi.fn();
  render(<AppraisalPropertyStep listing={{ ...fixture.listing, postcode: null }} appraisal={appraisal} onSaved={vi.fn()} onBusyChange={vi.fn()} onContinue={onContinue} />);
  fireEvent.click(screen.getByRole("button", { name: "Continue to evidence" }));
  await screen.findByRole("alert");
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(onContinue).not.toHaveBeenCalled();
});

it("retains a changed property after a failed save and retries with the current concurrency token", async () => {
  const onContinue = vi.fn();
  const onSaved = vi.fn();
  mocks.fetch.mockRejectedValueOnce(new Error("Unable to save this appraisal."))
    .mockResolvedValueOnce({ listing: { ...fixture.listing, listing_description: "New description" }, appraisal });
  render(<AppraisalPropertyStep listing={fixture.listing} appraisal={appraisal} onSaved={onSaved} onBusyChange={vi.fn()} onContinue={onContinue} />);
  fireEvent.change(screen.getByLabelText("Property description"), { target: { value: "New description" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue to evidence" }));
  await screen.findByText("Unable to save this appraisal.");
  expect((screen.getByLabelText("Property description") as HTMLTextAreaElement).value).toBe("New description");
  expect(onContinue).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Continue to evidence" }));
  await waitFor(() => expect(onContinue).toHaveBeenCalledOnce());
  expect(onSaved).toHaveBeenCalledOnce();
  const body = JSON.parse(mocks.fetch.mock.calls[1][1].body);
  expect(body).toMatchObject({ expected_updated_at: appraisal.updated_at, property: { listing_description: "New description" } });
});

it.each([null, 0])("keeps parking %s when other appraisal details are edited", async carSpaces => {
  const listing = { ...fixture.listing, car_spaces: carSpaces };
  const onContinue = vi.fn();
  mocks.fetch.mockResolvedValue({ listing, appraisal });
  render(<AppraisalPropertyStep listing={listing} appraisal={appraisal} onSaved={vi.fn()} onBusyChange={vi.fn()} onContinue={onContinue} />);
  expect((screen.getByLabelText("Car spaces") as HTMLInputElement).value).toBe(carSpaces === null ? "" : String(carSpaces));
  fireEvent.change(screen.getByLabelText("Property description"), { target: { value: "Updated property description" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue to evidence" }));
  await waitFor(() => expect(onContinue).toHaveBeenCalledOnce());
  expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).property.car_spaces).toBe(carSpaces);
});

it("accepts a deliberately cleared parking field as unknown", async () => {
  const onContinue = vi.fn();
  mocks.fetch.mockResolvedValue({ listing: { ...fixture.listing, car_spaces: null }, appraisal });
  render(<AppraisalPropertyStep listing={fixture.listing} appraisal={appraisal} onSaved={vi.fn()} onBusyChange={vi.fn()} onContinue={onContinue} />);
  fireEvent.change(screen.getByLabelText("Car spaces"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue to evidence" }));
  await waitFor(() => expect(onContinue).toHaveBeenCalledOnce());
  expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).property.car_spaces).toBeNull();
});

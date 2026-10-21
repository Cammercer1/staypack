// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AppraisalPropertyStep } from "./AppraisalPropertyStep";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import type { WorkspaceAppraisal } from "@/lib/appraisals/workspaceTypes";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/digital-proposals/ProposalWorkspaceControls", () => ({ proposalFetch: mocks.fetch }));
beforeEach(() => { mocks.fetch.mockReset(); });
afterEach(cleanup);
const fixture = createLintRegressionFixtures();
const appraisal: WorkspaceAppraisal = { ...fixture.appraisal, kind: "lease", inputs_json: { version: 1, listing: fixture.listing }, input_revision: 1, document_revision: 1, document_json: fixture.lease.final_report_json };
const continueButton = () => screen.getAllByRole("button", { name: "Continue to review estimate" })[0];

it("continues without rewriting untouched nullable property fields or invalidating reviewed evidence", async () => {
  const onContinue = vi.fn();
  render(<AppraisalPropertyStep listing={{ ...fixture.listing, listing_description: null }} appraisal={appraisal} onSaved={vi.fn()} onBusyChange={vi.fn()} onContinue={onContinue} />);
  fireEvent.click(continueButton());
  await waitFor(() => expect(onContinue).toHaveBeenCalledOnce());
  expect(mocks.fetch).not.toHaveBeenCalled();
});

it("still validates missing property details before continuing without changes", async () => {
  const onContinue = vi.fn();
  render(<AppraisalPropertyStep listing={{ ...fixture.listing, postcode: null }} appraisal={appraisal} onSaved={vi.fn()} onBusyChange={vi.fn()} onContinue={onContinue} />);
  fireEvent.click(continueButton());
  const error = await screen.findByRole("alert");
  const postcode = screen.getByLabelText("Postcode");
  expect(postcode.getAttribute("aria-invalid")).toBe("true");
  expect(postcode.getAttribute("aria-describedby")).toBe(error.id);
  expect(error.classList.contains("text-error")).toBe(true);
  await waitFor(() => expect(document.activeElement).toBe(postcode));
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
  fireEvent.click(continueButton());
  const error = await screen.findByRole("alert");
  expect(error.textContent).toBe("Unable to save this appraisal.");
  expect(error.className).toContain("du-alert-error du-alert-soft");
  await waitFor(() => expect(document.activeElement).toBe(error));
  expect((screen.getByLabelText("Property description") as HTMLTextAreaElement).value).toBe("New description");
  expect(onContinue).not.toHaveBeenCalled();
  fireEvent.click(continueButton());
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
  fireEvent.click(continueButton());
  await waitFor(() => expect(onContinue).toHaveBeenCalledOnce());
  expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).property.car_spaces).toBe(carSpaces);
});

it("accepts a deliberately cleared parking field as unknown", async () => {
  const onContinue = vi.fn();
  mocks.fetch.mockResolvedValue({ listing: { ...fixture.listing, car_spaces: null }, appraisal });
  render(<AppraisalPropertyStep listing={fixture.listing} appraisal={appraisal} onSaved={vi.fn()} onBusyChange={vi.fn()} onContinue={onContinue} />);
  fireEvent.change(screen.getByLabelText("Car spaces"), { target: { value: "" } });
  fireEvent.click(continueButton());
  await waitFor(() => expect(onContinue).toHaveBeenCalledOnce());
  expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).property.car_spaces).toBeNull();
});

it.each(["lease", "sales"] as const)("%s: leaves photo selection to Check proposal and preserves the existing cover when saving details", async kind => {
  const listing = { ...fixture.listing, hero_image_url: "https://example.com/existing-cover.jpg" };
  const onContinue = vi.fn();
  mocks.fetch.mockResolvedValue({ listing, appraisal });
  render(<AppraisalPropertyStep listing={listing} appraisal={{ ...appraisal, kind }} onSaved={vi.fn()} onBusyChange={vi.fn()} onContinue={onContinue} />);
  expect(screen.getByRole("heading", { name: "Confirm property" })).toBeTruthy();
  expect(screen.getByText("Changes apply to this appraisal only.")).toBeTruthy();
  expect(screen.getByText("(Optional)")).toBeTruthy();
  expect(screen.queryByLabelText("Cover photograph")).toBeNull();
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(screen.queryByText("Photo 1")).toBeNull();
  fireEvent.change(screen.getByLabelText("Property description"), { target: { value: "Updated description" } });
  fireEvent.click(continueButton());
  await waitFor(() => expect(onContinue).toHaveBeenCalledOnce());
  expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toMatchObject({
    expected_updated_at: appraisal.updated_at,
    property: { hero_image_url: listing.hero_image_url, listing_description: "Updated description" },
  });
});

it("keeps both Continue actions and property inputs disabled until saving finishes", async () => {
  const onContinue = vi.fn();
  const onSaved = vi.fn();
  const onBusyChange = vi.fn();
  let completeSave!: (value: unknown) => void;
  mocks.fetch.mockImplementation(() => new Promise(resolve => { completeSave = resolve; }));
  render(<AppraisalPropertyStep listing={fixture.listing} appraisal={appraisal} onSaved={onSaved} onBusyChange={onBusyChange} onContinue={onContinue} />);
  fireEvent.change(screen.getByLabelText("Property description"), { target: { value: "Updated description" } });
  fireEvent.click(continueButton());
  await waitFor(() => expect(mocks.fetch).toHaveBeenCalledOnce());
  const buttons = screen.getAllByRole("button", { name: "Saving…" });
  expect(buttons).toHaveLength(2);
  for (const button of buttons) {
    expect(button.matches(":disabled")).toBe(true);
    fireEvent.click(button);
  }
  expect(screen.getByLabelText("Property description").matches(":disabled")).toBe(true);
  expect(onBusyChange).toHaveBeenLastCalledWith(true);
  expect(onContinue).not.toHaveBeenCalled();
  await act(async () => { completeSave({ listing: fixture.listing, appraisal }); });
  await waitFor(() => expect(onContinue).toHaveBeenCalledOnce());
  expect(onSaved).toHaveBeenCalledOnce();
  expect(mocks.fetch).toHaveBeenCalledOnce();
  expect(onBusyChange).toHaveBeenLastCalledWith(false);
});

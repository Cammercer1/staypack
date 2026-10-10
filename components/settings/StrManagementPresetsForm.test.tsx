// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StrManagementPresetsForm } from "./StrManagementPresetsForm";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("saves valid company presets independently of report or estimate APIs", async () => {
  const presets = createLintRegressionFixtures().agency.str_management_presets!.filter((preset) => preset.mode !== "relative" && preset.mode !== "uplift");
  const fetcher = vi.fn().mockResolvedValue(Response.json({ presets })); vi.stubGlobal("fetch", fetcher);
  render(<StrManagementPresetsForm presets={presets} />);
  fireEvent.change(screen.getByLabelText("Preset name"), { target: { value: "Updated preset" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save management defaults" })); });
  expect(fetcher).toHaveBeenCalledOnce();
  expect(fetcher.mock.calls[0][0]).toBe("/api/agencies/str-presets");
  expect(JSON.parse(fetcher.mock.calls[0][1].body).presets[0]).toMatchObject({ name: "Updated preset", nightlyRate: 440, occupancyRate: 72 });
  expect(screen.getByRole("status").textContent).toContain("Existing reports keep their saved assumptions");
});

it("rejects impossible bookings without saving and can remove a preset", async () => {
  const presets = createLintRegressionFixtures().agency.str_management_presets!.filter((preset) => preset.mode !== "relative" && preset.mode !== "uplift");
  const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
  render(<StrManagementPresetsForm presets={presets} />);
  fireEvent.change(screen.getByLabelText("Unavailable nights / year"), { target: { value: "200" } });
  fireEvent.click(screen.getByRole("button", { name: "Save management defaults" }));
  await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("Booked nights exceed"));
  expect(fetcher).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Remove preset 1" }));
  expect(screen.queryByLabelText("Preset name")).toBeNull();
});

it("starts with zero uplift and saves the company's chosen percentage", async () => {
  const fetcher = vi.fn(async (_url, init) => Response.json(JSON.parse(init.body))); vi.stubGlobal("fetch", fetcher);
  render(<StrManagementPresetsForm />);
  fireEvent.click(screen.getByRole("button", { name: "Set up company defaults" }));
  expect(screen.getByLabelText("Management uplift (%)")).toHaveProperty("value", "0");
  expect(screen.queryByLabelText(/ADR adjustment/)).toBeNull();
  expect(screen.getByLabelText("Apply automatically to new reports")).toHaveProperty("checked", true);
  fireEvent.change(screen.getByLabelText("Management uplift (%)"), { target: { value: "28" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save management defaults" })); });
  expect(fetcher).toHaveBeenCalledOnce();
  const saved = JSON.parse(fetcher.mock.calls[0][1].body).presets[0];
  expect(saved).toMatchObject({ name: "Company management uplift", mode: "uplift", isDefault: true, upliftPercent: 28 });
  expect(saved).not.toHaveProperty("nightlyRate");
  expect(saved).not.toHaveProperty("adrPercent");
});

it("switches the automatic default without leaving two active defaults", async () => {
  const first = createLintRegressionFixtures().agency.str_management_presets!.find((preset) => preset.mode === "relative")!;
  const second = { ...first, id: "fa8eedcf-4618-4be4-9d34-a8d4f0c07f19", isDefault: false, name: "Second profile" };
  const fetcher = vi.fn(async (_url, init) => Response.json(JSON.parse(init.body))); vi.stubGlobal("fetch", fetcher);
  render(<StrManagementPresetsForm presets={[first, second]} />);
  fireEvent.click(screen.getAllByLabelText("Apply automatically to new reports")[1]);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save management defaults" })); });
  expect(JSON.parse(fetcher.mock.calls[0][1].body).presets.map((preset: { isDefault: boolean }) => preset.isDefault)).toEqual([false, true]);
});

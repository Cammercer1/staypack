// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { StrAppraisal } from "@/lib/str-appraisals/types";
import { AppraisalRoutes } from "@/components/appraisals/AppraisalRoutes";
import { AppraisalCustomerPanel } from "./AppraisalCustomerPanel";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/components/listings/UnsavedListingGuard", () => ({ UnsavedListingGuard: () => null }));
vi.mock("./AppraisalArchiveControl", () => ({ AppraisalArchiveControl: () => <button>Restore appraisal</button> }));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

const appraisal: StrAppraisal = {
  report_id: "report-123", agency_id: "agency-123", contact_id: null,
  recipient_mode: "general", recipient_name: null, recipient_email: null, recipient_phone: null, recipient_phone_e164: null,
  source: "manual", created_at: "2026-10-15T00:00:00Z", updated_at: "2026-10-15T00:00:00Z",
};

it("opens customer editing in a dialog and discards cancelled changes without changing the summary", async () => {
  const onEditingChange = vi.fn();
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ clients: [] }));
  vi.stubGlobal("fetch", fetcher);
  render(<AppraisalCustomerPanel initialAppraisal={appraisal} archived={false} onEditingChange={onEditingChange} />);
  expect(screen.getByText("No named contact")).toBeTruthy();
  expect(screen.queryByLabelText("Contact name")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Add contact" }));
  expect(screen.getByRole("dialog", { name: "Add contact" })).toBeTruthy();
  expect(onEditingChange).toHaveBeenLastCalledWith(true);
  fireEvent.click(screen.getByRole("button", { name: "Add new contact" }));
  fireEvent.change(screen.getByLabelText("Contact name"), { target: { value: "Unsaved customer" } });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(onEditingChange).toHaveBeenLastCalledWith(false);
  expect(fetcher.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Add contact" }));
  expect(screen.getByRole("combobox", { name: "Search contacts" })).toBeTruthy();
});

it.each([false, true])("keeps editing active during a save and uses the correct workspace route (shared=%s)", async shared => {
  const onEditingChange = vi.fn();
  const onSaved = vi.fn();
  let finishSave: (response: Response) => void = () => {};
  const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_input, init) => init?.method === "PATCH"
    ? new Promise<Response>(resolve => { finishSave = resolve; })
    : Response.json({ clients: [] }));
  vi.stubGlobal("fetch", fetcher);
  const panel = <AppraisalCustomerPanel initialAppraisal={appraisal} archived={false} onEditingChange={onEditingChange} onSaved={onSaved} />;
  render(shared ? <AppraisalRoutes>{panel}</AppraisalRoutes> : panel);
  fireEvent.click(screen.getByRole("button", { name: "Add contact" }));
  fireEvent.click(screen.getByRole("button", { name: "Add new contact" }));
  fireEvent.change(screen.getByLabelText("Contact name"), { target: { value: "Jordan Taylor" } });
  fireEvent.change(screen.getByLabelText("Email (optional)"), { target: { value: "jordan@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: "Save contact details" }));
  await waitFor(() => expect((screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement).disabled).toBe(true));
  expect((screen.getByRole("button", { name: "Close contact details" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(onEditingChange).toHaveBeenLastCalledWith(true);
  const saved: StrAppraisal = { ...appraisal, recipient_mode: "named", recipient_name: "Jordan Taylor", recipient_email: "jordan@example.com", updated_at: "2026-10-15T01:00:00Z" };
  finishSave(Response.json({ appraisal: saved }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(onSaved).toHaveBeenCalledWith(saved);
  expect(onEditingChange).toHaveBeenLastCalledWith(false);
  const summary = within(screen.getByRole("region", { name: "Contact · Prepared for" }));
  expect(summary.getByText("Jordan Taylor")).toBeTruthy();
  expect(summary.getByText("jordan@example.com")).toBeTruthy();
  const request = fetcher.mock.calls.find(([, init]) => init?.method === "PATCH");
  expect(request?.[0]).toBe(shared ? "/api/appraisals/report-123" : "/api/str/appraisals/report-123");
  expect(JSON.parse(String(request?.[1]?.body))).toMatchObject({ recipient: { mode: "named", name: "Jordan Taylor", email: "jordan@example.com" }, expected_updated_at: appraisal.updated_at });
  expect(router.refresh).not.toHaveBeenCalled();
});

it("preserves entered details and keeps publishing paused when a save fails", async () => {
  const onEditingChange = vi.fn();
  vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockImplementation(async (_input, init) => init?.method === "PATCH"
    ? Response.json({ error: "This appraisal changed. Reload before saving." }, { status: 409 })
    : Response.json({ clients: [] })));
  render(<AppraisalCustomerPanel initialAppraisal={appraisal} archived={false} onEditingChange={onEditingChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Add contact" }));
  fireEvent.click(screen.getByRole("button", { name: "Add new contact" }));
  fireEvent.change(screen.getByLabelText("Contact name"), { target: { value: "Jordan Taylor" } });
  fireEvent.click(screen.getByRole("button", { name: "Save contact details" }));
  expect((await screen.findByRole("alert")).textContent).toContain("This appraisal changed");
  expect((screen.getByLabelText("Contact name") as HTMLInputElement).value).toBe("Jordan Taylor");
  expect(onEditingChange).toHaveBeenLastCalledWith(true);
  expect((screen.getByRole("button", { name: "Close contact details" }) as HTMLButtonElement).disabled).toBe(false);
});

it("keeps archived customer details readable and retains the restore action", () => {
  render(<AppraisalCustomerPanel initialAppraisal={{ ...appraisal, recipient_mode: "named", recipient_name: "Jordan Taylor" }} archived />);
  expect(screen.getByText("Jordan Taylor")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Change contact" })).toBeNull();
  expect(screen.getByRole("button", { name: "Restore appraisal" })).toBeTruthy();
});

it("inherits the workspace publishing lock without opening the customer dialog", () => {
  render(<fieldset disabled><AppraisalCustomerPanel initialAppraisal={appraisal} archived={false} /></fieldset>);
  expect(screen.getByRole("button", { name: "Add contact" }).matches(":disabled")).toBe(true);
  expect(screen.queryByRole("dialog")).toBeNull();
});

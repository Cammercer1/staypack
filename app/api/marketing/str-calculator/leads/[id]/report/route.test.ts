import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), create: vi.fn() }));
vi.mock("next/navigation", () => ({ unstable_rethrow: vi.fn() }));
vi.mock("@/lib/auth/requireUser", () => ({ requireAgency: mocks.auth }));
vi.mock("@/lib/str-calculator/leadReport", () => ({
  createReportFromCalculatorLead: mocks.create,
  CalculatorReportError: class extends Error { constructor(message: string, public status: number) { super(message); } },
}));
import { CalculatorReportError } from "@/lib/str-calculator/leadReport";
import { POST } from "./route";
const id = "6500bfd0-04d8-4919-b458-84e9ec0ce331";
const request = () => new Request("https://staypack.app/api/marketing/str-calculator/leads/id/report", { method: "POST", body: JSON.stringify({ agency_id: "untrusted-agency", user_id: "untrusted-user" }) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ agency: { id: "trusted-agency" }, user: { id: "trusted-user" } });
  mocks.create.mockResolvedValue({ report_id: id, created: true, estimate_reused: true });
});

it("uses authenticated ownership, ignores submitted ownership, and returns a private response", async () => {
  const response = await POST(request(), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(mocks.create).toHaveBeenCalledExactlyOnceWith({ leadId: id, agency: { id: "trusted-agency" }, userId: "trusted-user" });
});

it("does not reach a privileged write without authentication", async () => {
  mocks.auth.mockRejectedValue(new Error("Authentication required"));
  await POST(request(), { params: Promise.resolve({ id }) });
  expect(mocks.create).not.toHaveBeenCalled();
});

it("rejects malformed lead IDs before reaching the service", async () => {
  const response = await POST(request(), { params: Promise.resolve({ id: "invalid" }) });
  expect(response.status).toBe(400);
  expect(mocks.create).not.toHaveBeenCalled();
});

it("preserves not-found responses for inaccessible leads", async () => {
  mocks.create.mockRejectedValue(new CalculatorReportError("Calculator enquiry not found.", 404));
  const response = await POST(request(), { params: Promise.resolve({ id }) });
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ error: "Calculator enquiry not found." });
});

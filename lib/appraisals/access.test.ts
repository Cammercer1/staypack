import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAgency: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/requireUser", () => ({ requireAgency: mocks.requireAgency }));
import { requireAppraisalAccess } from "./access";

const reportId = "dfd1e5d8-b322-4b26-a7ed-0e4283e2060c";
const row = () => ({ agency_id: "agency", report_id: reportId, inputs_json: null, report: { id: reportId, agency_id: "agency", listing_id: "listing", listing: { id: "listing", agency_id: "agency" } } });
beforeEach(() => {
  vi.resetAllMocks();
  const query = { select: mocks.select, eq: mocks.eq, maybeSingle: mocks.maybeSingle };
  mocks.from.mockReturnValue(query); mocks.select.mockReturnValue(query); mocks.eq.mockReturnValue(query);
  mocks.requireAgency.mockResolvedValue({ agency: { id: "agency" }, supabase: { from: mocks.from } });
  mocks.maybeSingle.mockResolvedValue({ data: row(), error: null });
});

it("keeps agency filters on every joined ownership boundary", async () => {
  const result = await requireAppraisalAccess(reportId);
  expect(result.report.id).toBe(reportId);
  for (const field of ["agency_id", "report.agency_id", "report.listing.agency_id"]) expect(mocks.eq).toHaveBeenCalledWith(field, "agency");
});

it.each(["report agency", "listing agency", "listing identity", "report identity"])("fails closed for a mismatched %s", async field => {
  const data = row();
  if (field === "report agency") data.report.agency_id = "other";
  if (field === "listing agency") data.report.listing.agency_id = "other";
  if (field === "listing identity") data.report.listing.id = "other";
  if (field === "report identity") data.report.id = "other";
  mocks.maybeSingle.mockResolvedValue({ data, error: null });
  await expect(requireAppraisalAccess(reportId)).rejects.toMatchObject({ status: 404 });
});

it("does not read an appraisal after membership is rejected", async () => {
  mocks.requireAgency.mockRejectedValue(new Error("Membership removed"));
  await expect(requireAppraisalAccess(reportId)).rejects.toThrow("Membership removed");
  expect(mocks.from).not.toHaveBeenCalled();
});

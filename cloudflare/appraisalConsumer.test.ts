import { beforeEach, expect, it, vi } from "vitest";
import { consumeAppraisalJobs } from "./appraisalConsumer";
import { AppraisalJobBusyError } from "../lib/appraisals/claimJob";
const mock = vi.hoisted(() => ({ read: vi.fn(), run: vi.fn() }));
vi.mock("../lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mock.read }) }) }) }) }));
vi.mock("../lib/lease-appraisal/runLeaseAppraisalJob", () => ({ runLeaseAppraisalJob: mock.run }));
vi.mock("../lib/sales-appraisal/runSalesAppraisalJob", () => ({ runSalesAppraisalJob: mock.run }));
const agencyId = "7943c756-ec76-4f77-a03a-ea4e6dc1ee64";
const message = () => ({ body: { kind: "lease", jobId: "ab2b9911-b448-42b1-ad41-f2a4db76ac86", agencyId }, attempts: 1, ack: vi.fn(), retry: vi.fn() });
beforeEach(() => { vi.clearAllMocks(); mock.read.mockResolvedValue({ data: { agency_id: agencyId }, error: null }); mock.run.mockResolvedValue({ status: "completed" }); });

it("acknowledges only after the job succeeds and retries transient errors", async () => {
  const first = message(), second = message();
  mock.run.mockRejectedValueOnce(new Error("Temporary provider failure"));
  await consumeAppraisalJobs({ messages: [first, second] });
  expect(first.ack).not.toHaveBeenCalled();
  expect(first.retry).toHaveBeenCalledWith({ delaySeconds: 15 });
  expect(second.ack).toHaveBeenCalledOnce();
});
it("never runs jobs from another agency or outside the preview fixture", async () => {
  const item = message();
  mock.read.mockResolvedValue({ data: { agency_id: "another" }, error: null });
  await consumeAppraisalJobs({ messages: [item] });
  await consumeAppraisalJobs({ messages: [message()] }, "not-the-fixture");
  expect(mock.run).not.toHaveBeenCalled();
  expect(item.ack).toHaveBeenCalledOnce();
});
it("delays duplicate delivery until the existing attempt's lease has expired", async () => {
  const item = message(); mock.run.mockRejectedValueOnce(new AppraisalJobBusyError());
  await consumeAppraisalJobs({ messages: [item] });
  expect(item.retry).toHaveBeenCalledWith({ delaySeconds: 601 });
});

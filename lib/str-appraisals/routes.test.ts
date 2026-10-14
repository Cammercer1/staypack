import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({access:vi.fn(),workspace:vi.fn(),listing:vi.fn(),create:vi.fn(),rpc:vi.fn()}));
vi.mock("@/lib/str-appraisals/service", () => ({requireStrAppraisalAccess:mocks.access,requireStrWorkspaceAccess:mocks.workspace,createStrAppraisal:mocks.create,listStrAppraisals:vi.fn()}));
vi.mock("@/lib/auth/requireUser", () => ({requireListingAccess:mocks.listing}));
import { PATCH } from "@/app/api/str/appraisals/[reportId]/route";
import { POST } from "@/app/api/str/appraisals/route";
const id = "10000000-0000-4000-8000-000000000001";
const recipient = {mode:"named",name:"Alex",email:"alex@example.test",phone:"0400 000 001"};
const request = (body:unknown) => new Request("http://localhost/api/str/appraisals",{method:"POST",body:JSON.stringify(body)});
beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue({supabase:{rpc:mocks.rpc},agency:{id:"agency"},appraisal:{report_id:id}});
  mocks.rpc.mockResolvedValue({data:{report_id:id,recipient_name:"Alex"},error:null});
  mocks.workspace.mockResolvedValue({supabase:{},agency:{id:"agency"}});
  mocks.listing.mockResolvedValue({listing:{id}});
  mocks.create.mockResolvedValue({id});
});
it("saves private customer details through the agency-scoped RPC without touching report JSON", async () => {
  const response = await PATCH(request({recipient,expected_updated_at:"2026-10-10T00:00:00Z"}),{params:Promise.resolve({reportId:id})});
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(mocks.rpc).toHaveBeenCalledWith("save_str_appraisal_recipient",expect.objectContaining({p_agency_id:"agency",p_report_id:id,p_recipient:expect.objectContaining({phone_e164:"+61400000001"})}));
  expect(JSON.stringify(mocks.rpc.mock.calls)).not.toContain("final_report_json");
});
it("returns a conflict instead of overwriting another editor's recipient", async () => {
  mocks.rpc.mockResolvedValue({data:null,error:{code:"PT409",message:"Reload before saving"}});
  expect((await PATCH(request({recipient,expected_updated_at:"2026-10-10T00:00:00Z"}),{params:Promise.resolve({reportId:id})})).status).toBe(409);
});
it("rejects inaccessible appraisals before any write", async () => {
  mocks.access.mockRejectedValue(new Error("STR appraisal not found"));
  expect((await PATCH(request({recipient}),{params:Promise.resolve({reportId:id})})).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("passes a stable client request ID through creation and validates the property", async () => {
  expect((await POST(request({listing_id:id,request_id:id,recipient}))).status).toBe(200);
  expect(mocks.listing).toHaveBeenCalledWith(id);
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({requestId:id,recipient}));
  expect((await POST(request({listing_id:id,recipient}))).status).toBe(400);
});

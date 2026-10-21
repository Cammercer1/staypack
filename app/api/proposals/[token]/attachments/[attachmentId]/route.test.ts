import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ published: vi.fn(), download: vi.fn() }));
vi.mock("@/lib/digital-proposals/published", () => ({ publishedProposal: mocks.published, ProposalError: class extends Error { constructor(message: string, public status: number) { super(message); } } }));
vi.mock("@/lib/digital-proposals/download", () => ({ downloadProposalAttachment: mocks.download }));
vi.mock("@/lib/digital-proposals/http", () => ({ proposalApiError: (error: { message: string; status: number }) => Response.json({ error: error.message }, { status: error.status || 500 }) }));
const versionId = "00000000-0000-4000-8000-000000000001";
const params = { params: Promise.resolve({ token: "token", attachmentId: "document" }) };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.published.mockResolvedValue({ id: versionId, agency_id: "agency", report_id: "report", snapshot: { attachments: [{ id: "document" }] } });
  mocks.download.mockResolvedValue(new Response("%PDF-1.4", { headers: { "Content-Type": "application/pdf" } }));
});

it("downloads an attachment from the displayed authorized version", async () => {
  const response = await GET(new Request(`https://staypack.app/api/proposals/token/attachments/document?version=${versionId}`), params);
  expect(response.status).toBe(200);
  expect(mocks.published).toHaveBeenCalledWith("token", versionId);
  expect(mocks.download).toHaveBeenCalledWith("agency", "report", "document");
});

it("does not expose documents outside the requested snapshot", async () => {
  mocks.published.mockResolvedValue({ snapshot: { attachments: [] } });
  expect((await GET(new Request(`https://staypack.app/api/proposals/token/attachments/document?version=${versionId}`), params)).status).toBe(404);
  expect(mocks.download).not.toHaveBeenCalled();
});

it("does not download when version access has been revoked", async () => {
  mocks.published.mockRejectedValue(Object.assign(new Error("Proposal not available."), { status: 404 }));
  expect((await GET(new Request(`https://staypack.app/api/proposals/token/attachments/document?version=${versionId}`), params)).status).toBe(404);
  expect(mocks.download).not.toHaveBeenCalled();
});

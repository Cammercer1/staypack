import { beforeEach, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ access: vi.fn(), snapshot: vi.fn(), download: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ storage: { from: () => ({ download: mocks.download }) } }) }));
vi.mock("@/lib/digital-proposals/published", () => ({ publishedProposalAccess: mocks.access, cachedProposalSnapshot: mocks.snapshot, ProposalError: class extends Error { constructor(message: string, public status: number) { super(message); } } }));
vi.mock("@/lib/digital-proposals/http", () => ({ proposalApiError: (error: { message: string; status: number }) => Response.json({ error: error.message }, { status: error.status || 500 }) }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.access.mockResolvedValue({ id: "version", content_hash: "hash", pdf_status: "ready", pdf_path: "saved.pdf" });
  mocks.download.mockResolvedValue({ data: new Blob(["%PDF-1.4"]), error: null });
});

it.each([
  [undefined, "Short-term rental proposal.pdf"],
  ["lease", "Rental appraisal.pdf"],
  ["sales", "Sales appraisal.pdf"],
])("names a downloaded %s appraisal for its frozen report kind", async (kind, filename) => {
  mocks.snapshot.mockResolvedValue({ data: { appraisal: kind ? { kind } : undefined } });
  const response = await GET(new Request("https://staypack.app/api/proposals/token/pdf"), { params: Promise.resolve({ token: "token" }) });
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Disposition")).toBe(`attachment; filename="${filename}"`);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.text()).toBe("%PDF-1.4");
  expect(mocks.snapshot).toHaveBeenCalledWith("version", "hash");
});

it("checks fresh access and PDF readiness before reading the frozen filename", async () => {
  mocks.access.mockResolvedValue({ pdf_status: "generating", pdf_path: null });
  const response = await GET(new Request("https://staypack.app/api/proposals/token/pdf"), { params: Promise.resolve({ token: "token" }) });
  expect(response.status).toBe(409);
  expect(mocks.snapshot).not.toHaveBeenCalled();
  expect(mocks.download).not.toHaveBeenCalled();
});

it("authorizes a version-pinned PDF before downloading its stored snapshot", async () => {
  mocks.snapshot.mockResolvedValue({ data: {} });
  const versionId = "00000000-0000-4000-8000-000000000001";
  const response = await GET(new Request(`https://staypack.app/api/proposals/token/pdf?version=${versionId}`), { params: Promise.resolve({ token: "token" }) });
  expect(response.status).toBe(200);
  expect(mocks.access).toHaveBeenCalledWith("token", versionId);
  expect(mocks.download).toHaveBeenCalledWith("saved.pdf");
});

it("does not download a version unavailable through the link", async () => {
  mocks.access.mockRejectedValue(Object.assign(new Error("Proposal not available."), { status: 404 }));
  const response = await GET(new Request("https://staypack.app/api/proposals/token/pdf?version=unavailable"), { params: Promise.resolve({ token: "token" }) });
  expect(response.status).toBe(404);
  expect(mocks.download).not.toHaveBeenCalled();
  expect(mocks.snapshot).not.toHaveBeenCalled();
});

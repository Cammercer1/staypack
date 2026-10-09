import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), suggest: vi.fn(), select: vi.fn() }));
vi.mock("@/lib/auth/requireUser", () => ({ requireAgency: mocks.auth }));
vi.mock("@/lib/geocoding/places", () => ({ autocompleteAddresses: mocks.suggest, completePlaceAddress: mocks.select }));
import { POST } from "./route";
const body = { action: "suggest", input: "18/8 Ascot", sessionToken: "04a22f81-999e-4c8d-b164-51b706029580" };
const call = (data = body) => POST(new Request("http://localhost/api", { method: "POST", body: JSON.stringify(data) }));
beforeEach(() => { vi.resetAllMocks(); mocks.auth.mockResolvedValue({}); mocks.suggest.mockResolvedValue([]); });
it("requires an agency session before calling Google", async () => {
  mocks.auth.mockRejectedValue(new Error("Unauthorized"));
  expect((await call()).status).toBe(503);
  expect(mocks.suggest).not.toHaveBeenCalled();
});
it("rejects short queries and invalid session tokens before billing calls", async () => {
  expect((await call({ ...body, input: "18" })).status).toBe(400);
  expect((await call({ ...body, sessionToken: "invalid" })).status).toBe(400);
  expect(mocks.suggest).not.toHaveBeenCalled();
});
it("returns suggestions without caching them", async () => {
  const response = await call();
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
  expect(await response.json()).toEqual({ suggestions: [] });
});

import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ load: vi.fn(), suggest: vi.fn(), select: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/str-calculator/service", () => ({
  loadPublicCalculator: mocks.load,
  CalculatorError: class extends Error { constructor(message: string, public status: number) { super(message); } },
}));
vi.mock("@/lib/geocoding/places", () => ({ autocompleteAddresses: mocks.suggest, completePlaceAddress: mocks.select }));

const token = "6500bfd0-04d8-4919-b458-84e9ec0ce331";
const sessionToken = "1500bfd0-04d8-4919-b458-84e9ec0ce331";
const input = { action: "suggest", input: "1/24 Cliffbrook", sessionToken, country: "US" };
let POST: typeof import("./route").POST;
beforeEach(async () => {
  vi.resetModules(); vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("NETLIFY", "true");
  mocks.load.mockImplementation(async value => value === token ? { widget: { country: "AU" } } : null);
  mocks.suggest.mockResolvedValue([{ placeId: "place", address: "1/24 Cliffbrook Parade, Clovelly NSW" }]);
  mocks.select.mockResolvedValue("1/24 Cliffbrook Parade, Clovelly NSW 2031");
  ({ POST } = await import("./route"));
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
function request(body: unknown = input, calculatorToken = token, forwarded = "untrusted") {
  return POST(new Request("https://staypack.app/api/str-calculator/widget/address-suggestions", {
    method: "POST", headers: { "Content-Type": "application/json", "x-nf-client-connection-ip": "trusted-client", "x-forwarded-for": forwarded },
    body: JSON.stringify(body),
  }), { params: Promise.resolve({ token: calculatorToken }) });
}
it("serves public suggestions without cookies using the widget country, not the submitted country", async () => {
  const response = await request();
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(mocks.suggest).toHaveBeenCalledExactlyOnceWith(input.input, sessionToken, "AU");
});
it("completes the selected address in the same Places session", async () => {
  const response = await request({ action: "select", country: "US", placeId: "place", address: "1/24 Cliffbrook Parade, Clovelly NSW", sessionToken });
  expect(await response.json()).toEqual({ address: "1/24 Cliffbrook Parade, Clovelly NSW 2031" });
  expect(mocks.select).toHaveBeenCalledWith("place", sessionToken, "1/24 Cliffbrook Parade, Clovelly NSW", "AU");
});
it("rejects paused or unknown calculators and never permits a production preview bypass", async () => {
  mocks.load.mockResolvedValue(null);
  expect((await request()).status).toBe(404);
  vi.stubEnv("NODE_ENV", "production");
  expect((await request(input, "preview")).status).toBe(404);
  expect(mocks.suggest).not.toHaveBeenCalled();
});
it("supports the local development preview without creating a widget or lead", async () => {
  vi.stubEnv("NODE_ENV", "development");
  expect((await request(input, "preview")).status).toBe(200);
  expect(mocks.load).not.toHaveBeenCalled();
  expect(mocks.suggest).toHaveBeenCalledWith(input.input, sessionToken, "US");
});
it("rejects invalid and oversized requests before calling Google", async () => {
  expect((await request({ ...input, sessionToken: "invalid" })).status).toBe(400);
  expect((await request({ ...input, input: "x".repeat(5000) })).status).toBe(413);
  expect(mocks.suggest).not.toHaveBeenCalled();
});
it("limits paid lookups regardless of spoofed forwarding headers or new sessions", async () => {
  vi.useFakeTimers();
  for (let index = 0; index < 60; index++) expect((await request({ ...input, sessionToken: crypto.randomUUID() }, token, `spoof-${index}`)).status).toBe(200);
  const response = await request();
  expect(response.status).toBe(429);
  expect(response.headers.get("retry-after")).toBe("3600");
  expect(mocks.suggest).toHaveBeenCalledTimes(60);
  vi.advanceTimersByTime(60_001);
  expect((await request()).status).toBe(200);
});
it("does not expose Google errors or credentials", async () => {
  mocks.suggest.mockRejectedValue(new Error("secret API key and upstream response"));
  const response = await request();
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("secret");
});

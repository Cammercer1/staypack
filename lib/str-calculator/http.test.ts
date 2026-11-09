import { afterEach, expect, it, vi } from "vitest";
import { calculatorClientAddress } from "./http";
afterEach(() => vi.unstubAllEnvs());
it("only trusts the connection header belonging to the configured host", () => {
  const request = new Request("https://staypack.app", { headers: { "cf-connecting-ip": "1.1.1.1", "x-nf-client-connection-ip": "2.2.2.2", "x-forwarded-for": "3.3.3.3" } });
  vi.stubEnv("NETLIFY", "true"); vi.stubEnv("CLOUDFLARE_APP", "");
  expect(calculatorClientAddress(request)).toBe("2.2.2.2");
  vi.stubEnv("CLOUDFLARE_APP", "1");
  expect(calculatorClientAddress(request)).toBe("1.1.1.1");
  expect(calculatorClientAddress(new Request("https://staypack.app"))).toBe("unknown");
});

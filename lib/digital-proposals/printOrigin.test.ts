import { afterEach, expect, it, vi } from "vitest";
import { proposalPrintOrigin } from "./printOrigin";

afterEach(() => vi.unstubAllEnvs());
it("renders a hosted candidate on its own trusted site, ignoring build-time deploy placeholders", () => {
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("SITE_NAME", "staypack");
  vi.stubEnv("SITE_URL", "https://staypack.app");
  vi.stubEnv("NEXT_PUBLIC_REPORTS_URL", "https://staypack.app");
  vi.stubEnv("DEPLOY_URL", "https://0--staypack.netlify.app");
  expect(proposalPrintOrigin("https://havenly-proposal-review--staypack.netlify.app/api/pdf")).toBe("https://havenly-proposal-review--staypack.netlify.app");
  expect(proposalPrintOrigin("https://staypack.app/api/pdf")).toBe("https://staypack.app");
  for (const url of ["https://attacker.netlify.app", "https://preview--staypack.netlify.app.evil.test", "http://localhost:3000", "https://user:password@staypack.app", "https://staypack.app:9000"]) {
    expect(proposalPrintOrigin(url)).toBe("https://staypack.app");
  }
});
it("keeps local production-server checks on the requested local port in development", () => {
  vi.stubEnv("APP_ENV", "development");
  expect(proposalPrintOrigin("http://localhost:3001/api/pdf")).toBe("http://localhost:3001");
});

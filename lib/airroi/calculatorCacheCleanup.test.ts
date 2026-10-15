import { afterEach, describe, expect, it, vi } from "vitest";
import cleanup, { config } from "../../netlify/functions/airroi-calculator-cache-cleanup.mjs";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("calculator cache cleanup", () => {
  it("only purges dedicated cache batches without enabling billing or calling the provider", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
    vi.stubEnv("BILLING_MODE", "disabled");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("1000"))
      .mockResolvedValueOnce(new Response("2"));
    vi.stubGlobal("fetch", fetchMock);
    expect((await cleanup()).status).toBe(204);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [url, options] of fetchMock.mock.calls) {
      expect(String(url)).toBe("https://example.supabase.co/rest/v1/rpc/purge_airroi_calculator_cache");
      expect(options.body).toBe('{"p_limit":1000}');
      expect(options.headers.authorization).toBe("Bearer test-service-key");
    }
    expect(process.env.BILLING_MODE).toBe("disabled");
    expect(config.schedule).toBe("*/5 * * * *");
  });

  it("does not silently ignore cleanup failures", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    await expect(cleanup()).rejects.toThrow("returned 503");
  });

  it("bounds a cleanup backlog", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-key");
    const fetchMock = vi.fn().mockImplementation(async () => new Response("1000"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(cleanup()).rejects.toThrow("batch limit");
    expect(fetchMock).toHaveBeenCalledTimes(20);
  });
});

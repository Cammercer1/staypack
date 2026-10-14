import { afterEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { fetchUsPropertyData } from "./client";
import { pastedListingUrl, zillowPropertyId } from "./url";
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("uses only the fixed RapidAPI host, server headers, a timeout and no cache", async () => {
  vi.stubEnv("RAPIDAPI_US_PROPERTY_KEY", "private-test-key");
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "OK", data: { zpid: "123" } })));
  vi.stubGlobal("fetch", fetch);
  expect(await fetchUsPropertyData("property-details", { zpid: "123" })).toEqual({ zpid: "123" });
  expect(fetch).toHaveBeenCalledWith("https://real-time-real-estate-data2.p.rapidapi.com/zillow/property-details?zpid=123", expect.objectContaining({ cache: "no-store", headers: { "X-RapidAPI-Key": "private-test-key", "X-RapidAPI-Host": "real-time-real-estate-data2.p.rapidapi.com" }, signal: expect.any(AbortSignal) }));
});
it("does not include provider response bodies or credentials in errors", async () => {
  vi.stubEnv("RAPIDAPI_US_PROPERTY_KEY", "private-test-key");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("private-test-key", { status: 429 })));
  await expect(fetchUsPropertyData("search", { location: "90048" })).rejects.toThrow("request limit");
});
it("accepts Zillow property links and rejects lookalike hosts or unrelated paths", () => {
  expect(zillowPropertyId("https://www.zillow.com/homedetails/545-Westbourne-Dr/20517162_zpid/")).toBe("20517162");
  for (const url of ["https://zillow.com.evil.test/homedetails/1_zpid/", "http://zillow.com/homedetails/1_zpid/", "https://zillow.com/homes/90048", "https://user:pass@zillow.com/homedetails/1_zpid/"]) expect(zillowPropertyId(url)).toBeNull();
  expect(zillowPropertyId("616 N Croft Ave Apt 2")).toBeNull();
  expect(pastedListingUrl(" www.zillow.com/homedetails/example/1_zpid/ ")).toBe("https://www.zillow.com/homedetails/example/1_zpid/");
  expect(pastedListingUrl("616 N Croft Ave Apt 2")).toBeNull();
});

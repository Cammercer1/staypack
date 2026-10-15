import { afterEach, expect, it, vi } from "vitest";
import { proposalFetch } from "./proposalFetch";

afterEach(() => vi.unstubAllGlobals());

it.each([
  [408, "The request timed out. Please try again shortly."],
  [504, "The request timed out. Please try again shortly."],
  [502, "The service is temporarily unavailable. Please try again shortly."],
  [503, "The service is temporarily unavailable. Please try again shortly."],
  [500, "The service could not complete this request. Please try again."],
  [429, "Too many requests. Please wait a moment and try again."],
  [403, "You don’t have permission to complete this request."],
  [200, "The server returned an unexpected response. Please try again."],
] as const)("reports a non-JSON %s without blaming the session or exposing its HTML", async (status, message) => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<html>private upstream details</html>", { status, headers: { "Content-Type": "text/html" } })));
  await expect(proposalFetch("/api/proposal")).rejects.toThrow(message);
});

it("reports an actual unauthorized response as an expired session", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Unauthorized", { status: 401 })));
  await expect(proposalFetch("/api/proposal")).rejects.toThrow("Your session has expired. Reload and sign in again.");
});

it("recognizes the login page after a followed redirect", async () => {
  const response = new Response("<html>Login</html>");
  Object.defineProperties(response, { redirected: { value: true }, url: { value: "https://staypack.app/login?next=/appraisals" } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  await expect(proposalFetch("/api/proposal")).rejects.toThrow("Your session has expired. Reload and sign in again.");
});

it("does not misclassify an unrelated HTML redirect as expired authentication", async () => {
  const response = new Response("<html>Service unavailable</html>");
  Object.defineProperties(response, { redirected: { value: true }, url: { value: "https://staypack.app/unavailable" } });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
  await expect(proposalFetch("/api/proposal")).rejects.toThrow("The server returned an unexpected response. Please try again.");
});

it("preserves structured API errors and successful JSON responses", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ error: "Review the draft changes first." }, { status: 409 })).mockResolvedValueOnce(Response.json({ revision: 4 })));
  await expect(proposalFetch("/api/proposal")).rejects.toThrow("Review the draft changes first.");
  await expect(proposalFetch("/api/proposal")).resolves.toEqual({ revision: 4 });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareReportPdf, reportRequest } from "./reportRequests";
const report = { id: "report", pdf_url: null, status: "generated" as const };
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("report request recovery", () => {
  it("returns a completed private PDF without publishing", async () => {
    const ready = { ...report, pdf_url: "new.pdf" };
    const fetcher = vi.fn().mockResolvedValue(Response.json({ report: ready }));
    vi.stubGlobal("fetch", fetcher);
    expect(await prepareReportPdf(report)).toEqual(ready);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({
      preview: true,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("recovers a PDF after an HTML gateway error without rendering twice", async () => {
    vi.useFakeTimers();
    const ready = { ...report, pdf_url: "new.pdf" };
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response("Gateway timeout", { status: 504 }))
      .mockResolvedValueOnce(Response.json({ report }))
      .mockResolvedValueOnce(Response.json({ report: ready }));
    vi.stubGlobal("fetch", fetcher);
    const recovering = vi.fn();
    const pending = prepareReportPdf(report, recovering);
    await vi.runAllTimersAsync();
    expect(await pending).toEqual(ready);
    expect(recovering).toHaveBeenCalledOnce();
    expect(
      fetcher.mock.calls.filter(([, init]) => init.method === "POST"),
    ).toHaveLength(1);
    expect(fetcher.mock.calls[1][1].cache).toBe("no-store");
  });
  it("does not mistake an older PDF for a completed regeneration and stops polling", async () => {
    vi.useFakeTimers();
    const stale = { ...report, pdf_url: "old.pdf" };
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockImplementation(async () => Response.json({ report: stale }));
    vi.stubGlobal("fetch", fetcher);
    const pending = expect(prepareReportPdf(stale)).rejects.toThrow(
      "Reload to check",
    );
    await vi.runAllTimersAsync();
    await pending;
    expect(fetcher).toHaveBeenCalledTimes(10);
  });
  it("surfaces validation and stale-content errors immediately", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ error: "The report changed" }, { status: 409 }),
      );
    vi.stubGlobal("fetch", fetcher);
    await expect(prepareReportPdf(report)).rejects.toThrow(
      "The report changed",
    );
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("gives a retryable error for a non-JSON successful response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>Timeout</html>")),
    );
    await expect(reportRequest("/api/test")).rejects.toMatchObject({
      recoverable: true,
    });
  });
});

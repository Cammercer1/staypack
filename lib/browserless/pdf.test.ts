import { afterEach, expect, it, vi } from "vitest";
import { browserlessRequest } from "./client";
import { renderPdfFromUrl } from "./pdf";
import { load } from "cheerio";

vi.mock("./client", () => ({ browserlessRequest: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("loads images from every print page before exporting, including lazy brand logos", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          '<html><body><div class="report-print-root"><section><img alt="Brand" loading="lazy" decoding="async" src="data:image/png;base64,AA=="></section><section><img alt="Brand" loading="lazy" decoding="async" src="data:image/png;base64,AA=="></section></div></body></html>',
        ),
      ),
  );
  vi.mocked(browserlessRequest).mockResolvedValue(Buffer.from("%PDF-test"));
  await renderPdfFromUrl("https://staypack.app/p/example/print");
  const body = vi.mocked(browserlessRequest).mock.calls[0][1] as {
    html: string;
    waitForFunction: { fn: string; timeout: number };
  };
  const $ = load(body.html);
  expect($('img[loading="eager"][decoding="sync"]')).toHaveLength(2);
  expect(body.waitForFunction.timeout).toBeGreaterThan(0);
  const images: { complete: boolean }[] = [
    { complete: true },
    { complete: false },
  ];
  const isReady = new Function(
    "document",
    `return (${body.waitForFunction.fn})();`,
  );
  expect(isReady({ images })).toBe(false);
  images[1].complete = true;
  expect(isReady({ images })).toBe(true);
});

it("sends readable contact details to the PDF renderer after loading an edge-protected print page", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          '<html><body><div class="report-print-root"><a href="/cdn-cgi/l/email-protection" class="__cf_email__" data-cfemail="3c485453515d4f1250505345587c5e595050594c4e534c594e4845125f5351">[email protected]</a></div></body></html>',
        ),
      ),
  );
  vi.mocked(browserlessRequest).mockResolvedValue(Buffer.from("%PDF-test"));
  const pdf = await renderPdfFromUrl("https://staypack.app/p/example/print");
  expect(pdf.toString()).toBe("%PDF-test");
  expect(browserlessRequest).toHaveBeenCalledWith(
    "/pdf",
    expect.objectContaining({
      html: expect.stringContaining("mailto:thomas.lloyd@belleproperty.com"),
    }),
    expect.anything(),
  );
  expect(vi.mocked(browserlessRequest).mock.calls[0][1]).toEqual(
    expect.objectContaining({
      html: expect.not.stringContaining("[email protected]"),
    }),
  );
});

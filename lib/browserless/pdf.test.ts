import { afterEach, expect, it, vi } from "vitest";
import { browserlessRequest } from "./client";
import { renderPdfFromUrl } from "./pdf";

vi.mock("./client", () => ({ browserlessRequest: vi.fn() }));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
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

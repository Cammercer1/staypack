import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { requireCollateralAccess } from "@/lib/auth/requireUser";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { salesBrochureNeedsRepublish } from "@/lib/collateral/sales-brochure/brochurePublishSync";
import { isBrochureDocument } from "@/lib/collateral/templates/types";
import type { CollateralItem } from "@/lib/types";

vi.mock("@/lib/auth/requireUser", () => ({ requireCollateralAccess: vi.fn() }));
vi.mock("@/lib/env", () => ({ getSiteUrl: () => "https://example.test" }));
afterEach(() => vi.clearAllMocks());

describe("brochure publication and PDF freshness", () => {
  async function publish(qrDraft: boolean) {
    const { collateral, document, agency } = createLintRegressionFixtures();
    const original: CollateralItem = {
      ...collateral,
      pdf_url: "https://example.test/prepared.pdf",
      document_json: {
        ...document,
        content_saved_at: "2026-10-09T01:00:00Z",
        pdf_synced_at: "2026-10-09T01:00:00Z",
        ...(qrDraft
          ? {
              document_link_draft: {
                link: {
                  mode: "custom" as const,
                  url: "https://example.test/property",
                },
                target_url: "https://example.test/property",
                qr_code_url: "https://example.test/qr.png",
              },
            }
          : {}),
      },
    };
    let saved: CollateralItem = original;
    const query = {
      update: vi.fn((values: Partial<CollateralItem>) => {
        saved = { ...original, ...values };
        return query;
      }),
      eq: vi.fn(() => query),
      select: vi.fn(() => query),
      single: vi.fn(async () => ({ data: saved, error: null })),
    };
    vi.mocked(requireCollateralAccess).mockResolvedValue({
      agency,
      collateral: original,
      supabase: { from: () => query },
    } as unknown as Awaited<ReturnType<typeof requireCollateralAccess>>);
    const response = await POST(
      new Request("https://example.test/api/collateral/mock/publish", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: original.id }) },
    );
    expect(response.status).toBe(200);
    expect(query.eq).toHaveBeenCalledWith("id", original.id);
    return saved;
  }
  it("keeps an already prepared PDF valid when only publishing its online link", async () => {
    const saved = await publish(false);
    expect(saved.status).toBe("published");
    expect(saved.pdf_url).toBe("https://example.test/prepared.pdf");
    expect(salesBrochureNeedsRepublish(saved)).toBe(false);
  });
  it("invalidates the PDF when publication applies a new QR destination", async () => {
    const saved = await publish(true);
    expect(saved.pdf_url).toBeNull();
    if (!saved.document_json || !isBrochureDocument(saved.document_json))
      throw new Error("Missing brochure");
    expect(saved.document_json.document_link_draft).toBeUndefined();
    expect(saved.document_json.document_link).toEqual({
      mode: "custom",
      url: "https://example.test/property",
    });
    expect(salesBrochureNeedsRepublish(saved)).toBe(true);
  });
});

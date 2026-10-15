import { afterEach, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { generateLeaseAppraisalReportContent } from "@/lib/lease-appraisal/generateLeaseAppraisalForListing";
import { generateSalesAppraisalReportContent } from "@/lib/sales-appraisal/generateSalesAppraisalForListing";
import { ReportChangedError } from "./publicationSnapshot";

vi.mock("@/lib/openai/generateLeaseAppraisalCopy", () => ({ generateLeaseAppraisalCopy: vi.fn() }));
vi.mock("@/lib/openai/generateSalesAppraisalCopy", () => ({ generateSalesAppraisalCopy: vi.fn() }));
afterEach(() => vi.clearAllMocks());

it.each(["lease", "sales"] as const)("rejects stale %s generation without overwriting a newer report or collateral", async kind => {
  const fixture = createLintRegressionFixtures();
  const report = { ...fixture[kind], status: "published" as const };
  const query = {
    update: vi.fn(() => query), eq: vi.fn(() => query), select: vi.fn(() => query),
    single: vi.fn(async () => ({ data: null, error: { code: "PGRST116", message: "No matching version" } })),
  };
  const from = vi.fn(() => query);
  const generate = kind === "lease" ? generateLeaseAppraisalReportContent : generateSalesAppraisalReportContent;
  await expect(generate({
    supabase: { from } as unknown as SupabaseClient,
    agency: fixture.agency, listing: fixture.listing, report, agencyAgents: [fixture.agent],
  })).rejects.toBeInstanceOf(ReportChangedError);
  expect(query.eq).toHaveBeenCalledWith("updated_at", report.updated_at);
  expect(from).toHaveBeenCalledExactlyOnceWith("reports");
});

import { afterEach, expect, it, vi } from "vitest";
import type { ReactElement } from "react";
import PublicReportPage from "@/app/(public)/[agencySlug]/[reportSlug]/page";
import PublicReportPrintPage from "@/app/(public)/[agencySlug]/[reportSlug]/print/page";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAgencyBySlug } from "@/lib/agencies/resolveAgencyBySlug";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { preservePublishedReport } from "./publicationSnapshot";
import type { FinalReportJson } from "@/lib/types";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/env", () => ({ hasServiceRoleKey: () => true }));
vi.mock("@/lib/agencies/resolveAgencyBySlug", () => ({ resolveAgencyBySlug: vi.fn(), agencySlugNeedsRedirect: () => false }));
vi.mock("@/components/reports/ReportPreview", () => ({ ReportPreview: () => null }));
afterEach(() => vi.clearAllMocks());

it.each([
  [PublicReportPage, false], [PublicReportPage, true],
  [PublicReportPrintPage, false], [PublicReportPrintPage, true],
] as const)("renders the saved public revision without later property, copy or brand changes (draft: %s)", async (page, hasDraft) => {
  const { report, agency } = createLintRegressionFixtures();
  report.status = "published";
  const original = report.final_report_json!;
  report.final_report_json = hasDraft ? preservePublishedReport(report, {
    ...original,
    copy: { ...original.copy, heading: "Private new heading" },
    property: { ...original.property, display_price: "$99 million" },
    document_link_draft: { link: { mode: "custom", url: "https://private.example" }, target_url: "https://private.example", qr_code_url: "private-qr.png" },
  }) : original;
  const query = { select: vi.fn(() => query), eq: vi.fn(() => query), maybeSingle: vi.fn(async () => ({ data: report, error: null })) };
  const from = vi.fn(() => query);
  vi.mocked(createAdminClient).mockReturnValue({ from } as unknown as ReturnType<typeof createAdminClient>);
  vi.mocked(resolveAgencyBySlug).mockResolvedValue({ ...agency, name: "New unpublished agency brand" });
  const result = await page({ params: Promise.resolve({ agencySlug: agency.slug, reportSlug: "public-report" }) });
  const preview = result.props.children as ReactElement<{ report: FinalReportJson }>;
  expect(preview.props.report).toEqual(original);
  expect(JSON.stringify(preview.props.report)).not.toContain("private");
  expect(from).toHaveBeenCalledExactlyOnceWith("reports");
});

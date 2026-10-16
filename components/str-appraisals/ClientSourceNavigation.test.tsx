// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import NewAppraisalPage from "@/app/(app)/appraisals/new/page";
import NewStrAppraisalPage from "@/app/(app)/short-term-rentals/appraisals/new/page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }), notFound: vi.fn() }));
vi.mock("@/lib/auth/requireUser", () => ({ requireAgency: async () => ({ supabase: {}, agency: { id: "agency" }, user: { id: "user" } }), requireListingAccess: vi.fn() }));
vi.mock("@/lib/str-appraisals/service", () => ({ requireStrWorkspaceAccess: async () => ({ supabase: {}, agency: { id: "agency" }, user: { id: "user" } }) }));
vi.mock("@/components/properties/PropertyStartFlow", () => ({ PropertyStartFlow: () => <p>Choose property</p> }));
vi.mock("@/lib/clients/sourceRecipient", () => ({ loadRecipientFromSource: async (_db: unknown, _agency: string, id: string) => ({ mode: "named", name: id === "source-a" ? "Jordan Taylor" : "Sam Taylor", email: "", phone: "" }) }));
afterEach(cleanup);

it.each(["str", "lease", "sales"] as const)("resets the selected client when navigation changes the explicit source report for %s", async kind => {
  async function page(source: string) {
    return kind === "str" ? NewStrAppraisalPage({ searchParams: Promise.resolve({ source_report_id: source }) }) : NewAppraisalPage({ searchParams: Promise.resolve({ kind, source_report_id: source }) });
  }
  const view = render(await page("source-a"));
  expect(screen.getByText("Jordan Taylor")).toBeTruthy();
  view.rerender(await page("source-b"));
  expect(screen.getByText("Sam Taylor")).toBeTruthy();
  expect(screen.queryByText("Jordan Taylor")).toBeNull();
});

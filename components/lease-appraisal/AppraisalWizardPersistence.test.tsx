// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { LeaseAppraisalWizard } from "./LeaseAppraisalWizard";
import { SalesAppraisalWizard } from "@/components/sales-appraisal/SalesAppraisalWizard";

vi.mock("next/image", () => ({ default: () => null }));
vi.mock("@/components/reports/FittedReportPreview", () => ({ FittedReportPreview: () => <div>Document preview</div> }));
vi.mock("@/components/appraisals/AppraisalDeliveryStep", () => ({ AppraisalDeliveryStep: () => <div>Saved document delivery</div> }));
vi.mock("@/components/appraisals/AppraisalTemplateGallery", () => ({
  AppraisalTemplateGallery: ({ product, onChange, onReady }: {
    product: string;
    onChange: (id: string) => void;
    onReady: (ready: boolean) => void;
  }) => {
    useEffect(() => onReady(true), [onReady]);
    return <button onClick={() => onChange(`haven-properties-${product === "lease" ? "lease" : "sales"}-appraisal`)}>Choose another design</button>;
  },
}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function wizard(kind: "lease" | "sales", changedEvidence = false) {
  const fixture = createLintRegressionFixtures();
  const Component = kind === "lease" ? LeaseAppraisalWizard : SalesAppraisalWizard;
  const report = fixture[kind];
  if (changedEvidence) {
    fixture.listing.appraisal_overrides_json = kind === "lease"
      ? { lease: { weeklyMin: 1400, weeklyMax: 1600, weeklyMidpoint: 1500 } }
      : { sales: { priceMin: 2600000, priceMax: 2800000, priceMidpoint: 2700000 } };
  }
  const collateral = { ...(kind === "lease" ? fixture.leaseCollateral : fixture.salesCollateral), template_id: report.template_id };
  render(<Component agency={fixture.agency} initialAgencyAgents={[fixture.agent]} initialListing={fixture.listing}
    initialReport={report} initialCollateral={collateral} />);
  return { ...fixture, report, collateral };
}

it.each(["lease", "sales"] as const)("saves %s evidence before changing tabs and keeps failed edits available", async kind => {
  const responses: ((response: Response) => void)[] = [];
  const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise<Response>(resolve => responses.push(resolve)));
  vi.stubGlobal("fetch", fetcher);
  const { listing } = wizard(kind);
  fireEvent.click(screen.getByRole("tab", { name: /Review evidence/ }));
  const field = await screen.findByLabelText(kind === "lease" ? "Weekly midpoint ($)" : "Price midpoint ($)");
  fireEvent.change(field, { target: { value: kind === "lease" ? "1350" : "2550000" } });
  fireEvent.click(screen.getByRole("tab", { name: /Edit report/ }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  expect(screen.getByRole("tab", { name: /Review evidence/ }).getAttribute("aria-selected")).toBe("true");
  responses[0](Response.json({ error: "Please retry" }, { status: 500 }));
  await waitFor(() => expect((screen.getByRole("tab", { name: /Edit report/ }) as HTMLButtonElement).disabled).toBe(false));
  expect((field as HTMLInputElement).value).toBe(kind === "lease" ? "1350" : "2550000");
  fireEvent.click(screen.getByRole("tab", { name: /Edit report/ }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  const [url, init] = fetcher.mock.calls[1];
  expect(url).toBe(`/api/listings/${listing.id}/${kind}-appraisal/data`);
  expect(JSON.parse(String(init?.body))[kind === "lease" ? "weekly_midpoint" : "price_midpoint"]).toBe(kind === "lease" ? 1350 : 2550000);
  responses[1](Response.json({ listing }));
  await waitFor(() => expect(screen.getByRole("tab", { name: /Edit report/ }).getAttribute("aria-selected")).toBe("true"));
  expect(screen.getByRole("status").textContent).toBe("Unsaved changes");
});

it.each(["lease", "sales"] as const)("requires review of changed %s evidence after reopening a saved report", kind => {
  vi.stubGlobal("fetch", vi.fn<typeof fetch>());
  wizard(kind, true);
  expect(screen.getByRole("tab", { name: /Edit report/ }).getAttribute("aria-selected")).toBe("true");
  expect(screen.queryByText("Saved document delivery")).toBeNull();
  expect(screen.getByRole("status").textContent).toBe("Unsaved changes");
});

it.each(["lease", "sales"] as const)("persists the %s design before allowing a different tab", async kind => {
  const responses: ((response: Response) => void)[] = [];
  const fetcher = vi.fn<typeof fetch>().mockImplementation(() => new Promise<Response>(resolve => responses.push(resolve)));
  vi.stubGlobal("fetch", fetcher);
  const { report, collateral } = wizard(kind);
  fireEvent.click(screen.getByRole("tab", { name: /Design/ }));
  fireEvent.click(await screen.findByRole("button", { name: "Choose another design" }));
  fireEvent.click(screen.getByRole("tab", { name: /Review evidence/ }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  expect(screen.getByRole("tab", { name: /Design/ }).getAttribute("aria-selected")).toBe("true");
  const template_id = `haven-properties-${kind}-appraisal`;
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toEqual({ template_id });
  responses[0](Response.json({ report: { ...report, template_id } }));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("tab", { name: /Design/ }).getAttribute("aria-selected")).toBe("true");
  responses[1](Response.json({ collateral: { ...collateral, template_id } }));
  await waitFor(() => expect(screen.getByRole("tab", { name: /Review evidence/ }).getAttribute("aria-selected")).toBe("true"));
  expect(screen.getByRole("tab", { name: /Download & share/ }).getAttribute("aria-disabled")).toBe("true");
});

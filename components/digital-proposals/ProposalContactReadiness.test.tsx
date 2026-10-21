// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useForm, useWatch } from "react-hook-form";
import { createProposalFixture } from "@/lib/digital-proposals/fixtures";
import { DEFAULT_PROPOSAL_DRAFT, type ProposalDraft } from "@/lib/digital-proposals/template";
import { BRAND_DEFAULTS } from "@/lib/digital-proposals/brand";
import type { ProposalData } from "@/lib/digital-proposals/data";
import { ProposalContactReadiness } from "./ProposalContactReadiness";
import { DigitalProposal } from "./DigitalProposal";

afterEach(cleanup);
function Review({ data, hidden = false, disabled = false }: { data: ProposalData; hidden?: boolean; disabled?: boolean }) {
  const form = useForm<ProposalDraft>({ defaultValues: { ...DEFAULT_PROPOSAL_DRAFT, pages: DEFAULT_PROPOSAL_DRAFT.pages.map(page => ({ ...page, enabled: hidden && page.kind === "next_steps" ? false : page.enabled })) } });
  const draft = useWatch({ control: form.control }) as ProposalDraft;
  return <ProposalContactReadiness data={data} draft={draft} form={form} agents={[]} disabled={disabled} />;
}

it("shows a nonblocking reminder with a direct agent chooser when no response method exists", () => {
  render(<Review data={createProposalFixture()} />);
  expect(screen.getByRole("status").textContent).toContain("You can still publish without them");
  expect(screen.getByRole("button", { name: "Choose agents" })).toBeTruthy();
  expect(screen.getByRole("link", { name: /Add agency contact details/ }).getAttribute("href")).toBe("/settings/agency");
});

it("lets users restore Next steps and then confirms the agency response method", () => {
  const data = createProposalFixture(); data.agency.email = "team@example.com";
  render(<Review data={data} hidden />);
  expect(screen.getByRole("status").textContent).toContain("Next steps page is not included");
  fireEvent.click(screen.getByRole("button", { name: "Include Next steps page" }));
  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.getByText(/team@example.com/)).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Choose agents" })).toBeNull();
});

it("keeps readiness edits disabled during save or publication", () => {
  render(<Review data={createProposalFixture()} hidden disabled />);
  expect((screen.getByRole("button", { name: "Choose agents" }) as HTMLButtonElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Include Next steps page" }) as HTMLButtonElement).disabled).toBe(true);
});

it("renders actionable agency contacts and truthful PDF guidance in the next-steps preview", () => {
  const data = createProposalFixture();
  data.agency.phone = "+61 2 9000 1234"; data.agency.email = "team@example.com";
  render(<DigitalProposal data={data} draft={DEFAULT_PROPOSAL_DRAFT} brand={BRAND_DEFAULTS} page={DEFAULT_PROPOSAL_DRAFT.pages.find(page => page.kind === "next_steps")} previewPdfDownload />);
  expect(screen.getByRole("link", { name: /Call Coast & Country/ }).getAttribute("href")).toBe("tel:+61290001234");
  expect(screen.getByRole("link", { name: /Email Coast & Country/ }).getAttribute("href")).toBe("mailto:team%40example.com");
  expect(screen.queryByRole("button", { name: "Download proposal PDF" })).toBeNull();
  expect(screen.getByText(/PDF downloads are available in the final Get link or PDF step/)).toBeTruthy();
});

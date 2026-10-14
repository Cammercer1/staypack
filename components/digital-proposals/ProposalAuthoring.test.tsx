// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useForm, useWatch } from "react-hook-form";
import { DEFAULT_PROPOSAL_DRAFT, type ProposalDraft } from "@/lib/digital-proposals/template";
import { ProposalAgentPicker } from "./ProposalAgentPicker";
import { ProposalPagesEditor } from "./ProposalWorkspaceControls";
const agents = ["Alex", "Taylor", "Sam"].map(name => ({ id: crypto.randomUUID(), name, role: "Property specialist", phone: "", email: "", photoUrl: "" }));
afterEach(cleanup);
function Editor() {
  const form = useForm<ProposalDraft>({ defaultValues: DEFAULT_PROPOSAL_DRAFT });
  const draft = useWatch({ control: form.control }) as ProposalDraft;
  return <><ProposalPagesEditor form={form} draft={draft} contentEditable={false} /><ProposalAgentPicker form={form} selected={draft.agentIds} agents={agents} /></>;
}
it("keeps brand pages selectable and reorderable without page text or add controls", () => {
  render(<Editor />);
  expect(screen.queryByLabelText("Page title")).toBeNull();
  expect(screen.queryByLabelText("Page content")).toBeNull();
  expect(screen.queryByRole("button", { name: /^Add$/ })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Move Comparable listings up" }));
  expect(screen.getAllByRole("checkbox")[2].getAttribute("aria-label")).toBe("Include Comparable listings");
  fireEvent.click(screen.getByLabelText("Include Comparable listings"));
  expect((screen.getByLabelText("Include Comparable listings") as HTMLInputElement).checked).toBe(false);
  expect((screen.getByLabelText("Include Our management service") as HTMLInputElement).disabled).toBe(true);
});
it("attaches multiple agents and makes room when an agent is removed", () => {
  render(<Editor />);
  fireEvent.click(screen.getByLabelText("Attach Alex"));
  fireEvent.click(screen.getByLabelText("Attach Taylor"));
  expect((screen.getByLabelText("Attach Sam") as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText("Attach Alex"));
  expect((screen.getByLabelText("Attach Sam") as HTMLInputElement).disabled).toBe(false);
  fireEvent.click(screen.getByLabelText("Attach Sam"));
  expect((screen.getByLabelText("Attach Sam") as HTMLInputElement).checked).toBe(true);
});

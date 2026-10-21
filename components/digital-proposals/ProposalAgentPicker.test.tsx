// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { useForm, useWatch } from "react-hook-form";
import { DEFAULT_PROPOSAL_DRAFT, type ProposalDraft } from "@/lib/digital-proposals/template";
import type { ProposalAgentOption } from "@/lib/digital-proposals/agents";
import { ProposalAgentPicker } from "./ProposalAgentPicker";

const agents = ["Alex", "Taylor", "Sam"].map(name => ({ id: name, name, role: "Property specialist", phone: "", email: `${name.toLowerCase()}@agency.example`, photoUrl: "" }));
afterEach(cleanup);

function Picker({ selected = [], disabled = false, available = agents }: { selected?: string[]; disabled?: boolean; available?: ProposalAgentOption[] }) {
  const form = useForm<ProposalDraft>({ defaultValues: { ...DEFAULT_PROPOSAL_DRAFT, agentIds: selected } });
  const agentIds = useWatch({ control: form.control, name: "agentIds" });
  return <><ProposalAgentPicker form={form} selected={agentIds} agents={available} disabled={disabled} /><output data-testid="saved-agents">{agentIds.join(",")}</output></>;
}

it("distinguishes same-name agents by contact details while preserving their separate IDs", async () => {
  const available = [
    { ...agents[0], id: "first-alex", email: "alex.sales@agency.example" },
    { ...agents[0], id: "second-alex", email: "alex.leasing@agency.example" },
  ];
  render(<Picker available={available} />);
  fireEvent.click(screen.getByRole("button", { name: "Choose agents" }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Attach Alex (Property specialist · alex.leasing@agency.example)" }));
  expect((screen.getByRole("checkbox", { name: "Attach Alex (Property specialist · alex.sales@agency.example)" }) as HTMLInputElement).checked).toBe(false);
  fireEvent.click(screen.getByRole("button", { name: "Add agents" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByTestId("saved-agents").textContent).toBe("second-alex");
  fireEvent.click(screen.getByRole("button", { name: "Remove Alex (Property specialist · alex.leasing@agency.example) from proposal" }));
  expect(screen.getByTestId("saved-agents").textContent).toBe("");
  expect(screen.getByText("Make this proposal yours")).toBeTruthy();
});

it("keeps indistinguishable team records individually selectable without merging them", () => {
  render(<Picker available={[{ ...agents[0], id: "first-alex" }, { ...agents[0], id: "second-alex" }]} />);
  fireEvent.click(screen.getByRole("button", { name: "Choose agents" }));
  fireEvent.click(screen.getByRole("checkbox", { name: /Team record 2/ }));
  fireEvent.click(screen.getByRole("button", { name: "Add agents" }));
  expect(screen.getByTestId("saved-agents").textContent).toBe("second-alex");
});

it("keeps selections pending until applied and discards cancelled changes", async () => {
  render(<Picker selected={["Alex"]} />);
  expect(screen.queryByLabelText("Attach Taylor")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Choose agents" }));
  fireEvent.click(screen.getByLabelText("Attach Taylor"));
  expect(screen.getByTestId("saved-agents").textContent).toBe("Alex");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.click(screen.getByRole("button", { name: "Choose agents" }));
  expect((screen.getByLabelText("Attach Taylor") as HTMLInputElement).checked).toBe(false);
  fireEvent.click(screen.getByLabelText("Attach Sam"));
  fireEvent.click(screen.getByRole("button", { name: "Update agents" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByTestId("saved-agents").textContent).toBe("Alex,Sam");
});

it("preserves hidden selections while searching and enforces the combined selection limit", () => {
  render(<Picker />);
  fireEvent.click(screen.getByRole("button", { name: "Choose agents" }));
  fireEvent.click(screen.getByLabelText("Attach Alex"));
  fireEvent.change(screen.getByLabelText("Search agents"), { target: { value: "taylor@agency.example" } });
  expect(screen.queryByLabelText("Attach Alex")).toBeNull();
  fireEvent.click(screen.getByLabelText("Attach Taylor"));
  fireEvent.change(screen.getByLabelText("Search agents"), { target: { value: "" } });
  expect((screen.getByLabelText("Attach Alex") as HTMLInputElement).checked).toBe(true);
  expect((screen.getByLabelText("Attach Sam") as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Add agents" }));
  expect(screen.getByTestId("saved-agents").textContent).toBe("Alex,Taylor");
});

it("requires unavailable agents to be removed before applying the selection", async () => {
  render(<Picker selected={["missing"]} />);
  fireEvent.click(screen.getByRole("button", { name: "Choose agents" }));
  fireEvent.click(screen.getByLabelText("Attach Alex"));
  expect((screen.getByRole("button", { name: "Update agents" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Remove unavailable agent" }));
  fireEvent.click(screen.getByRole("button", { name: "Update agents" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(screen.getByTestId("saved-agents").textContent).toBe("Alex");
});

it("disables changes in the portal if saving begins with the chooser open", () => {
  const { rerender } = render(<Picker />);
  fireEvent.click(screen.getByRole("button", { name: "Choose agents" }));
  fireEvent.click(screen.getByLabelText("Attach Alex"));
  rerender(<Picker disabled />);
  expect((screen.getByLabelText("Attach Taylor") as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "Add agents" }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.getByTestId("saved-agents").textContent).toBe("");
});

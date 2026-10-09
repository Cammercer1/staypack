// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AgentProfileForm } from "./AgentProfileForm";
import type { AgentProfile } from "@/lib/types";
vi.mock("./AgentPhotoUploader", () => ({
  AgentPhotoUploader: ({
    onBusyChange,
  }: {
    onBusyChange: (busy: boolean) => void;
  }) => (
    <button type="button" onClick={() => onBusyChange(true)}>
      Test uploading
    </button>
  ),
}));
const agent = {
  id: "one",
  name: "Alex",
  email: "alex@example.com",
  role_title: "Agent",
  phone: "",
  photo_url: null,
  is_default: false,
  updated_at: "2026-10-08T00:00:00Z",
} as AgentProfile;
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const name = () => screen.getByLabelText(/Name \(required\)/);
const change = (value: string) =>
  fireEvent.change(name(), { target: { value } });
it("shows inline validation and focuses the name without saving", async () => {
  render(<AgentProfileForm initial={agent} onSaved={vi.fn()} />);
  change("   ");
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText("Name is required");
  expect(name().getAttribute("aria-invalid")).toBe("true");
  await waitFor(() => expect(document.activeElement).toBe(name()));
  expect(fetchMock).not.toHaveBeenCalled();
});
it("marks optional fields and validates email visibly", async () => {
  render(<AgentProfileForm initial={agent} onSaved={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Email (optional)"), {
    target: { value: "invalid" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() =>
    expect(
      screen.getByLabelText("Email (optional)").getAttribute("aria-invalid"),
    ).toBe("true"),
  );
  expect(fetchMock).not.toHaveBeenCalled();
});
it("disables unchanged saves and restores edits on discard", () => {
  render(<AgentProfileForm initial={agent} onSaved={vi.fn()} />);
  expect(
    (screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  change("Edited");
  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  expect((name() as HTMLInputElement).value).toBe("Alex");
});
it("retains edits after a network failure and can retry", async () => {
  fetchMock
    .mockRejectedValueOnce(new Error("Network unavailable"))
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ agent: { ...agent, name: "New name" } }),
    });
  const saved = vi.fn();
  render(<AgentProfileForm initial={agent} onSaved={saved} />);
  change("New name");
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText(/Network unavailable/);
  expect((name() as HTMLInputElement).value).toBe("New name");
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(JSON.parse(fetchMock.mock.calls[1][1].body).updated_at).toBe(
    agent.updated_at,
  );
});
it("handles non-JSON and conflict responses without losing edits", async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    json: async () => {
      throw new Error();
    },
  });
  render(<AgentProfileForm initial={agent} onSaved={vi.fn()} />);
  change("Changed");
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText(/Could not save this agent/);
  expect(
    (screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement)
      .disabled,
  ).toBe(false);
});
it("blocks a matching email without an override and offers the existing profile", async () => {
  const edit = vi.fn();
  render(
    <AgentProfileForm
      agents={[agent]}
      onSaved={vi.fn()}
      onEditDuplicate={edit}
    />,
  );
  change("Alex");
  fireEvent.change(screen.getByLabelText("Email (optional)"), {
    target: { value: " ALEX@example.com " },
  });
  await screen.findByText("Agent already exists");
  expect(
    (screen.getByRole("button", { name: "Add agent" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  expect(screen.queryByLabelText(/I’ve checked/)).toBeNull();
  fireEvent.submit(screen.getByRole("form", { name: "Add agent profile" }));
  await screen.findByText(/An agent already uses/);
  expect(fetchMock).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Edit existing agent" }));
  expect(edit).toHaveBeenCalledWith(agent);
});
it("allows a same-name person with different contact details", async () => {
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ agent }) });
  const saved = vi.fn();
  render(<AgentProfileForm agents={[agent]} onSaved={saved} />);
  change("Alex");
  fireEvent.change(screen.getByLabelText("Email (optional)"), {
    target: { value: "different@example.com" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add agent" }));
  await waitFor(() => expect(saved).toHaveBeenCalled());
});
it("blocks saves while the photo is being prepared", () => {
  render(<AgentProfileForm initial={agent} onSaved={vi.fn()} />);
  change("New");
  fireEvent.click(screen.getByRole("button", { name: "Test uploading" }));
  expect(
    (screen.getByRole("button", { name: "Save changes" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});
it("announces replacement of the agency default", () => {
  render(
    <AgentProfileForm
      initial={agent}
      agents={[{ ...agent, id: "other", name: "Taylor", is_default: true }]}
      onSaved={vi.fn()}
    />,
  );
  fireEvent.click(screen.getByLabelText("Use as agency default"));
  expect(screen.getByText(/replace Taylor/)).toBeTruthy();
});

it("shows a server-discovered match when another tab created the profile", async () => {
  fetchMock.mockResolvedValue({
    ok: false,
    json: async () => ({
      error: "An agent already uses this email or phone.",
      duplicateAgent: agent,
    }),
  });
  const edit = vi.fn();
  render(<AgentProfileForm onSaved={vi.fn()} onEditDuplicate={edit} />);
  change("New name");
  fireEvent.change(screen.getByLabelText("Email (optional)"), {
    target: { value: agent.email },
  });
  fireEvent.click(screen.getByRole("button", { name: "Add agent" }));
  await screen.findByText("Agent already exists");
  expect(
    (screen.getByRole("button", { name: "Add agent" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Edit existing agent" }));
  expect(edit).toHaveBeenCalledWith(agent);
});
it("blocks matching archived phones and offers the archived profile", () => {
  render(
    <AgentProfileForm
      agents={[{ ...agent, phone: "0412345678", archived_at: "2026-10-09" }]}
      onSaved={vi.fn()}
      onEditDuplicate={vi.fn()}
    />,
  );
  change("Different name");
  fireEvent.change(screen.getByLabelText("Phone (optional)"), {
    target: { value: "+61 412 345 678" },
  });
  expect(screen.getByText("Agent already exists")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "View archived agent" }),
  ).toBeTruthy();
  expect(
    (screen.getByRole("button", { name: "Add agent" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
});

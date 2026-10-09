// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AgentsManager } from "./AgentsManager";
import type { AgentDirectoryEntry } from "@/lib/agents/directory";
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("./AgentPhotoUploader", () => ({ AgentPhotoUploader: () => null }));
const agent = {
  id: "11111111-1111-4111-8111-111111111111",
  agency_id: "agency",
  name: "Alex",
  email: "alex@example.com",
  role_title: "Agent",
  phone: "",
  photo_url: null,
  is_default: false,
  archived_at: null,
  updated_at: "2026-10-08T00:00:00Z",
  created_at: "2026-10-08T00:00:00Z",
  listings: [
    { id: "listing", address: "1 Main Street", match: "assigned" as const },
  ],
} satisfies AgentDirectoryEntry;
const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it("renders a directory, search and sorting without open forms", () => {
  render(<AgentsManager initialAgents={[agent]} />);
  expect(screen.queryByRole("form")).toBeNull();
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "missing" },
  });
  expect(screen.getByText("No matching agents")).toBeTruthy();
  fireEvent.change(screen.getByRole("searchbox"), {
    target: { value: "alex@example" },
  });
  expect(screen.getByRole("button", { name: "Edit Alex" })).toBeTruthy();
});
it("opens a consistent editor and guards closing dirty changes", async () => {
  render(<AgentsManager initialAgents={[agent]} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit Alex" }));
  fireEvent.change(screen.getByLabelText(/Name \(required\)/), {
    target: { value: "Edited" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await screen.findByText("Discard unsaved changes?");
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(
    (screen.getByLabelText(/Name \(required\)/) as HTMLInputElement).value,
  ).toBe("Edited");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  fireEvent.click(
    await screen.findByRole("button", { name: "Discard changes" }),
  );
  await waitFor(() => expect(screen.queryByRole("form")).toBeNull());
});
it("protects unsaved drafts from tab reloads", async () => {
  render(<AgentsManager initialAgents={[agent]} />);
  fireEvent.click(screen.getByRole("button", { name: "Add agent" }));
  fireEvent.change(screen.getByLabelText(/Name \(required\)/), {
    target: { value: "Draft" },
  });
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
});
it("shows assigned listings and profile role restrictions", () => {
  render(<AgentsManager initialAgents={[agent]} canManage={false} />);
  expect(screen.queryByRole("button", { name: "Add agent" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "View Alex" }));
  expect(screen.queryByRole("button", { name: "Archive agent" })).toBeNull();
  fireEvent.click(screen.getByText("Linked listings (1)"));
  expect(
    screen.getByRole("link", { name: /1 Main Street/ }).getAttribute("href"),
  ).toBe("/listings/listing");
});
it("archives only after confirmation and removes the active row", async () => {
  const archived = { ...agent, archived_at: "2026-10-09T00:00:00Z" };
  fetchMock
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ agent: archived }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ agents: [archived] }),
    });
  render(<AgentsManager initialAgents={[agent]} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit Alex" }));
  fireEvent.click(screen.getByRole("button", { name: "Archive agent" }));
  expect(fetchMock).not.toHaveBeenCalled();
  const confirm = await screen.findByRole("dialog", { name: "Archive Alex?" });
  fireEvent.click(
    within(confirm).getByRole("button", { name: "Archive agent" }),
  );
  await waitFor(() =>
    expect(screen.queryByRole("button", { name: "Edit Alex" })).toBeNull(),
  );
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).action).toBe("archive");
  fireEvent.change(screen.getByLabelText("Agent status"), {
    target: { value: "archived" },
  });
  expect(await screen.findByRole("button", { name: "View Alex" })).toBeTruthy();
});
it("restores archived profiles without restoring a former default", async () => {
  fetchMock
    .mockResolvedValueOnce({ ok: true, json: async () => ({ agent }) })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ agents: [agent] }),
    });
  render(
    <AgentsManager initialAgents={[{ ...agent, archived_at: "yesterday" }]} />,
  );
  fireEvent.change(screen.getByLabelText("Agent status"), {
    target: { value: "archived" },
  });
  fireEvent.click(screen.getByRole("button", { name: "View Alex" }));
  fireEvent.click(screen.getByRole("button", { name: "Restore agent" }));
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).action).toBe("restore");
});
it("keeps failed archive actions retryable", async () => {
  fetchMock.mockRejectedValue(new Error("Offline"));
  render(<AgentsManager initialAgents={[agent]} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit Alex" }));
  fireEvent.click(screen.getByRole("button", { name: "Archive agent" }));
  const confirm = await screen.findByRole("dialog", { name: "Archive Alex?" });
  fireEvent.click(
    within(confirm).getByRole("button", { name: "Archive agent" }),
  );
  await within(confirm).findByText("Offline");
  expect(
    (
      within(confirm).getByRole("button", {
        name: "Archive agent",
      }) as HTMLButtonElement
    ).disabled,
  ).toBe(false);
});
it("keeps known directory rows after a refresh failure", async () => {
  fetchMock
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ agent: { ...agent, name: "Updated" } }),
    })
    .mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Unavailable" }),
    });
  render(<AgentsManager initialAgents={[agent]} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit Alex" }));
  fireEvent.change(screen.getByLabelText(/Name \(required\)/), {
    target: { value: "Updated" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  await screen.findByText(/directory could not refresh/);
  expect(screen.getByRole("button", { name: "Edit Updated" })).toBeTruthy();
});

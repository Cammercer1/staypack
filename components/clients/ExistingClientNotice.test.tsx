// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ExistingClientNotice } from "./ExistingClientNotice";

const client = { id: "00000000-0000-4000-8000-000000000001", name: "Jordan Taylor", email: "jordan@example.com", phone: null };
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("hides partial email results and excludes the client being edited", () => {
  const { rerender } = render(<ExistingClientNotice email="jordan@example.co" previewClients={[client]} onSelect={vi.fn()} />);
  expect(screen.queryByText("A saved client already uses this email.")).toBeNull();
  rerender(<ExistingClientNotice email={client.email} excludeId={client.id} previewClients={[client]} onSelect={vi.fn()} />);
  expect(screen.queryByText("A saved client already uses this email.")).toBeNull();
});

it("directs archived matches to their directory record instead of selecting them", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ clients: [{ ...client, archived_at: "2026-10-16T00:00:00Z" }] })));
  render(<ExistingClientNotice email={client.email} onSelect={vi.fn()} />);
  expect((await screen.findByRole("link", { name: "View archived client" })).getAttribute("href")).toBe(`/clients?client=${client.id}`);
  expect(screen.queryByRole("button", { name: "Use existing client" })).toBeNull();
});

it("does not show a stale match after the entered email changes", async () => {
  let completeFirst!: (response: Response) => void;
  const fetcher = vi.fn<typeof fetch>().mockImplementationOnce(() => new Promise<Response>(resolve => { completeFirst = resolve; })).mockResolvedValue(Response.json({ clients: [] }));
  vi.stubGlobal("fetch", fetcher);
  const { rerender } = render(<ExistingClientNotice email={client.email} onSelect={vi.fn()} />);
  await waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  rerender(<ExistingClientNotice email="new@example.com" onSelect={vi.fn()} />);
  await act(async () => completeFirst(Response.json({ clients: [client] })));
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  expect(screen.queryByText("A saved client already uses this email.")).toBeNull();
  expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
});

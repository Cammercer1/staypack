// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useRemoteOptions } from "./useRemoteOptions";
function Results({ query }: { query: string }) { const result = useRemoteOptions<{ name: string }>(`/api/clients?q=${query}`, "clients"); return <div>{result.data.map(row => <p key={row.name}>{row.name}</p>)}{result.error && <p role="alert">{result.error}</p>}</div>; }
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("immediately hides stale matches while a new search is pending or fails", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ clients: [{ name: "Jordan" }] })).mockResolvedValueOnce(Response.json({ error: "Search unavailable" }, { status: 500 }));
  vi.stubGlobal("fetch", fetcher);
  const view = render(<Results query="jordan" />);
  await screen.findByText("Jordan");
  view.rerender(<Results query="sam" />);
  expect(screen.queryByText("Jordan")).toBeNull();
  await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("Search unavailable"));
  expect(screen.queryByText("Jordan")).toBeNull();
});

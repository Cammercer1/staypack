// @vitest-environment jsdom
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AddressAutocomplete } from "./AddressAutocomplete";
const request = vi.fn();
const suggestion = { placeId: "property", address: "18/8 Ascot Street, Kensington NSW", mainText: "18/8 Ascot Street", secondaryText: "Kensington NSW" };
const reply = (data: unknown) => ({ ok: true, json: async () => data });
function Harness() {
  const [value, setValue] = useState("");
  const [resolving, setResolving] = useState(false);
  return <><label htmlFor="address">Property address</label><AddressAutocomplete id="address" value={value} onChange={setValue} onResolvingChange={setResolving} /><button disabled={resolving}>Find property</button></>;
}
beforeEach(() => { vi.useFakeTimers(); request.mockReset(); vi.stubGlobal("fetch", request); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
async function advance() { await act(async () => { await vi.advanceTimersByTimeAsync(300); }); }
it("debounces typing and selects via keyboard using the same session, then starts a fresh session", async () => {
  request.mockResolvedValueOnce(reply({ suggestions: [suggestion] })).mockResolvedValueOnce(reply({ address: `${suggestion.address} 2033` })).mockResolvedValueOnce(reply({ suggestions: [] }));
  render(<Harness />);
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "18/8 Asc" } });
  fireEvent.change(input, { target: { value: "18/8 Ascot" } });
  expect(request).not.toHaveBeenCalled();
  await advance();
  expect(request).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("listbox")).toBeTruthy();
  expect(screen.getByText("Google Maps")).toBeTruthy();
  fireEvent.keyDown(input, { key: "ArrowDown" });
  await act(async () => { fireEvent.keyDown(input, { key: "Enter" }); });
  expect((input as HTMLInputElement).value).toBe(`${suggestion.address} 2033`);
  expect(screen.queryByRole("listbox")).toBeNull();
  const first = JSON.parse(request.mock.calls[0][1].body);
  expect(JSON.parse(request.mock.calls[1][1].body).sessionToken).toBe(first.sessionToken);
  fireEvent.change(input, { target: { value: "12/22A New St" } });
  await advance();
  expect(JSON.parse(request.mock.calls[2][1].body).sessionToken).not.toBe(first.sessionToken);
});
it("ignores a stale response after the address changes and keeps manual input available on failure", async () => {
  let resolveOld!: (value: unknown) => void;
  request.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; })).mockRejectedValueOnce(new Error("Offline"));
  render(<Harness />);
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "18/8 Ascot" } });
  await advance();
  fireEvent.change(input, { target: { value: "12/22A New" } });
  await act(async () => resolveOld(reply({ suggestions: [suggestion] })));
  expect(screen.queryByRole("listbox")).toBeNull();
  await advance();
  expect(screen.getByText(/suggestions are unavailable/)).toBeTruthy();
  expect((input as HTMLInputElement).value).toBe("12/22A New");
  expect((screen.getByRole("button", { name: "Find property" }) as HTMLButtonElement).disabled).toBe(false);
});
it("supports mouse selection and Escape closes the suggestions", async () => {
  request.mockResolvedValueOnce(reply({ suggestions: [suggestion] })).mockResolvedValueOnce(reply({ address: `${suggestion.address} 2033` }));
  render(<Harness />);
  const input = screen.getByRole("combobox");
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: "18/8 Ascot" } });
  await advance();
  fireEvent.keyDown(input, { key: "Escape" });
  expect(screen.queryByRole("listbox")).toBeNull();
  fireEvent.focus(input);
  await act(async () => { fireEvent.click(screen.getByRole("option")); });
  expect((input as HTMLInputElement).value).toBe(`${suggestion.address} 2033`);
});

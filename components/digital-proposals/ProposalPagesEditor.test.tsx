// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useForm, useWatch } from "react-hook-form";
import { DEFAULT_PROPOSAL_DRAFT, type ProposalDraft, type ProposalPage } from "@/lib/digital-proposals/template";
import { ProposalPagesEditor } from "./ProposalPagesEditor";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Editor({ pages = DEFAULT_PROPOSAL_DRAFT.pages, disabled = false, contentEditable = false }: {
  pages?: ProposalPage[]; disabled?: boolean; contentEditable?: boolean;
}) {
  const form = useForm<ProposalDraft>({ defaultValues: { ...DEFAULT_PROPOSAL_DRAFT, pages } });
  const draft = useWatch({ control: form.control }) as ProposalDraft;
  return <><ProposalPagesEditor form={form} draft={draft} disabled={disabled} contentEditable={contentEditable} /><div data-testid="draft" hidden>{JSON.stringify(draft.pages)}</div></>;
}

function savedPages(): ProposalPage[] {
  return JSON.parse(screen.getByTestId("draft").textContent!);
}

function measureRows() {
  const list = screen.getByRole("list", { name: "Proposal page order" });
  vi.spyOn(list, "getBoundingClientRect").mockReturnValue({ top: 0, height: 480 } as DOMRect);
  within(list).getAllByRole("listitem").forEach((row, index) => {
    vi.spyOn(row, "getBoundingClientRect").mockReturnValue({ top: index * 80, height: 80 } as DOMRect);
  });
  return list;
}

it("reorders by keyboard, announces the result and preserves hidden pages", () => {
  render(<Editor />);
  const handle = screen.getByRole("button", { name: "Reorder Comparable listings" });
  handle.focus();
  fireEvent.keyDown(handle, { key: "ArrowUp" });
  expect(savedPages().map(page => page.id)).toEqual(["property", "appraisal", "evidence", "forecast", "service", "next-steps"]);
  expect(screen.getByRole("status").textContent).toBe("Moved Comparable listings to position 3 of 5.");
  expect(document.activeElement).toBe(handle);
  fireEvent.keyDown(handle, { key: "End" });
  expect(savedPages().at(-1)?.id).toBe("evidence");
  expect(savedPages().find(page => page.id === "service")?.enabled).toBe(false);
});

it("previews pointer dragging and commits the complete page order only on drop", () => {
  render(<Editor />);
  const list = measureRows();
  fireEvent.pointerDown(screen.getByRole("button", { name: "Reorder Your property" }), { button: 0, pointerId: 1, clientY: 40 });
  fireEvent.pointerMove(list, { pointerId: 1, clientY: 310 });
  expect(within(list).getAllByRole("checkbox")[3].getAttribute("aria-label")).toBe("Include Your property");
  expect(savedPages()[0].id).toBe("property");
  fireEvent.pointerUp(list, { pointerId: 1, clientY: 310 });
  expect(savedPages().map(page => page.id)).toEqual(["appraisal", "forecast", "evidence", "property", "service", "next-steps"]);
  expect(screen.getByRole("status").textContent).toBe("Moved Your property to position 4 of 5.");
});

it.each(["pointercancel", "Escape", "window blur"])("cancels a touch drag on %s without changing the draft", cancellation => {
  render(<Editor />);
  const list = measureRows();
  fireEvent.pointerDown(screen.getByRole("button", { name: "Reorder Rental appraisal" }), { button: 0, pointerId: 2, pointerType: "touch", clientY: 120 });
  fireEvent.pointerMove(list, { pointerId: 2, pointerType: "touch", clientY: 470 });
  expect(within(list).getAllByRole("checkbox").at(-1)?.getAttribute("aria-label")).toBe("Include Rental appraisal");
  if (cancellation === "Escape") fireEvent.keyDown(document, { key: "Escape" });
  else if (cancellation === "window blur") fireEvent(window, new Event("blur"));
  else fireEvent.pointerCancel(list, { pointerId: 2 });
  fireEvent.pointerUp(list, { pointerId: 2 });
  expect(savedPages()).toEqual(DEFAULT_PROPOSAL_DRAFT.pages);
  expect(within(list).getAllByRole("checkbox")[1].getAttribute("aria-label")).toBe("Include Rental appraisal");
  expect(screen.getByRole("status").textContent).toContain("Page order unchanged");
});

it("keeps the final included page enabled and hides the unconfigured optional service choice", () => {
  render(<Editor pages={DEFAULT_PROPOSAL_DRAFT.pages.map(page => ({ ...page, enabled: page.id === "property" }))} />);
  const property = screen.getByLabelText("Include Your property") as HTMLInputElement;
  expect(property.disabled).toBe(true);
  fireEvent.click(property);
  expect(savedPages().filter(page => page.enabled).map(page => page.id)).toEqual(["property"]);
  expect(screen.queryByLabelText("Include Our management service")).toBeNull();
  expect(savedPages().find(page => page.id === "service")).toEqual(DEFAULT_PROPOSAL_DRAFT.pages.find(page => page.id === "service"));
  fireEvent.click(screen.getByLabelText("Include Rental appraisal"));
  expect(property.disabled).toBe(false);
  fireEvent.click(property);
  expect(savedPages().filter(page => page.enabled).map(page => page.id)).toEqual(["appraisal"]);
  expect(screen.getByText("1 included")).toBeTruthy();
});

it("moves across an unconfigured service page without changing its saved slot or content", () => {
  const pages = [...DEFAULT_PROPOSAL_DRAFT.pages];
  const [service] = pages.splice(4, 1);
  pages.splice(1, 0, service);
  render(<Editor pages={pages} />);
  fireEvent.click(screen.getByRole("button", { name: "Move Your property down" }));
  expect(savedPages().map(page => page.id)).toEqual(["appraisal", "service", "property", "forecast", "evidence", "next-steps"]);
  expect(savedPages()[1]).toEqual(service);
  expect((screen.getByRole("button", { name: "Move Next steps down" }) as HTMLButtonElement).disabled).toBe(true);
});

it.each(["configured", "enabled", "studio"])("keeps a %s service page available without changing it on render", state => {
  const pages = DEFAULT_PROPOSAL_DRAFT.pages.map(page => page.id === "service" ? {
    ...page, body: state === "configured" ? "Our management service" : "", enabled: state === "enabled",
  } : page);
  render(<Editor pages={pages} contentEditable={state === "studio"} />);
  expect(screen.getByLabelText("Include Our management service")).toBeTruthy();
  expect(savedPages()).toEqual(pages);
});

it("blocks reordering while disabled, including a drag that began before disabling", () => {
  const { rerender } = render(<Editor />);
  const list = measureRows();
  fireEvent.pointerDown(screen.getByRole("button", { name: "Reorder Your property" }), { button: 0, pointerId: 1, clientY: 40 });
  fireEvent.pointerMove(list, { pointerId: 1, clientY: 310 });
  rerender(<Editor disabled />);
  fireEvent.pointerUp(list, { pointerId: 1, clientY: 310 });
  fireEvent.keyDown(screen.getByRole("button", { name: "Reorder Your property" }), { key: "End" });
  fireEvent.click(screen.getByRole("button", { name: "Move Your property down" }));
  expect(savedPages()).toEqual(DEFAULT_PROPOSAL_DRAFT.pages);
});

it("retains studio page editing, addition and removal while protecting the final page", () => {
  render(<Editor contentEditable pages={[{ id: "page-custom", kind: "text", title: "Team", body: "Meet the team", enabled: true }]} />);
  expect((screen.getByRole("button", { name: "Remove page" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Add" }));
  fireEvent.change(screen.getByLabelText("Page title"), { target: { value: "Our approach" } });
  fireEvent.change(screen.getByLabelText("Page content"), { target: { value: "A personal service" } });
  expect(savedPages()[1]).toMatchObject({ title: "Our approach", body: "A personal service", enabled: true });
  fireEvent.click(screen.getByRole("button", { name: "Remove page" }));
  expect(savedPages()).toHaveLength(1);
  expect(savedPages()[0].title).toBe("Team");
});

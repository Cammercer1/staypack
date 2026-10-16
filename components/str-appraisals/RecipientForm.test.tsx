// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { RecipientValues } from "@/lib/str-appraisals/validation";
import { RecipientForm } from "./RecipientForm";

const contacts = vi.hoisted(() => ({ data: [] as Array<{ id: string; name: string; email: string; phone: string }> }));
vi.mock("./useRemoteOptions", () => ({ useRemoteOptions: () => ({ data: contacts.data, loading: false, error: null }) }));
vi.mock("@/components/listings/UnsavedListingGuard", () => ({ UnsavedListingGuard: () => null }));
beforeEach(() => { contacts.data = []; });
afterEach(cleanup);

it("adds a client inline and preserves entered details after a failed save", async () => {
  let fail!: (error: Error) => void;
  const onSubmit = vi.fn<(values: RecipientValues) => Promise<void>>(() => new Promise<void>((_, reject) => { fail = reject; }));
  render(<RecipientForm initialValues={{ mode: "named", name: "", email: "", phone: "", contact_id: "" }} onSubmit={onSubmit} submitLabel="Save client" />);
  fireEvent.click(screen.getByRole("button", { name: "Add new client" }));
  const name = screen.getByLabelText("Client name") as HTMLInputElement;
  fireEvent.change(name, { target: { value: "Jordan Taylor" } });
  fireEvent.click(screen.getByRole("button", { name: "Save client" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  expect(name.closest("fieldset")?.disabled).toBe(true);
  await act(async () => fail(new Error("Connection lost. Please retry.")));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Connection lost. Please retry.");
  expect(name.value).toBe("Jordan Taylor");
  expect(name.closest("fieldset")?.disabled).toBe(false);
  expect(screen.getByText(/The client name appears on the proposal/).textContent).toContain("Email and phone stay private");
});

it("selects an existing client by keyboard and submits the full identity snapshot", async () => {
  const contact = { id: "00000000-0000-4000-8000-000000000001", name: "Jordan Taylor", email: "jordan@example.com", phone: "0412345678" };
  contacts.data = [contact];
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<RecipientForm initialValues={{ mode: "named", name: "", email: "", phone: "" }} onSubmit={onSubmit} submitLabel="Save client" />);
  const search = screen.getByRole("combobox", { name: "Search clients" });
  fireEvent.keyDown(search, { key: "ArrowDown" });
  expect(search.getAttribute("aria-activedescendant")).toBe(screen.getByRole("option").id);
  fireEvent.keyDown(search, { key: "Enter" });
  expect(screen.getByText("Jordan Taylor")).toBeTruthy();
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Change client" }));
  fireEvent.click(screen.getByRole("button", { name: "Save client" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ mode: "named", contact_id: contact.id, name: contact.name, email: contact.email, phone: contact.phone }));
});

it("offers the existing client for a normalized email without overwriting their saved details", async () => {
  const contact = { id: "00000000-0000-4000-8000-000000000001", name: "Jordan Taylor", email: "jordan@example.com", phone: "0412345678" };
  contacts.data = [contact];
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<RecipientForm initialValues={{ mode: "named", name: "Jordan New", email: " JORDAN@EXAMPLE.COM ", phone: "0400000000" }} onSubmit={onSubmit} submitLabel="Save client" />);
  expect(screen.getByText("A saved client already uses this email.")).toBeTruthy();
  expect(screen.getByLabelText("Client name")).toHaveProperty("value", "Jordan New");
  fireEvent.click(screen.getByRole("button", { name: "Use existing client" }));
  fireEvent.click(screen.getByRole("button", { name: "Save client" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ mode: "named", contact_id: contact.id, name: contact.name, email: contact.email, phone: contact.phone }));
  expect(contacts.data[0]).toEqual(contact);
});

it("validates new clients and explicitly clears identity for no named client", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<RecipientForm initialValues={{ mode: "named", name: "", email: "", phone: "" }} onSubmit={onSubmit} submitLabel="Create appraisal" />);
  fireEvent.click(screen.getByRole("button", { name: "Add new client" }));
  fireEvent.click(screen.getByRole("button", { name: "Create appraisal" }));
  expect((await screen.findByRole("alert")).textContent).toMatch(/Enter the client.*name/);
  expect(onSubmit).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "No named client" }));
  expect(screen.queryByLabelText("Client name")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Create appraisal" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ mode: "general", contact_id: "", name: "", email: "", phone: "" }));
});

it("keeps a calculator lead's email and phone when completing its missing name", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<RecipientForm initialValues={{ mode: "named", name: "", email: "jordan@example.com", phone: "0412345678" }} onSubmit={onSubmit} submitLabel="Save client" />);
  expect(screen.getByLabelText("Email (optional)")).toHaveProperty("value", "jordan@example.com");
  fireEvent.change(screen.getByLabelText("Client name"), { target: { value: "Jordan Taylor" } });
  fireEvent.click(screen.getByRole("button", { name: "Save client" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ mode: "named", name: "Jordan Taylor", email: "jordan@example.com", phone: "0412345678" }));
});


it("locks selectable clients while the report recipient is saving", async () => {
  contacts.data = [{ id: "00000000-0000-4000-8000-000000000001", name: "Jordan Taylor", email: "jordan@example.com", phone: "0412345678" }];
  const onSubmit = vi.fn(() => new Promise<void>(() => {}));
  render(<RecipientForm initialValues={{ mode: "named", name: "Current Client", email: "current@example.com", phone: "" }} onSubmit={onSubmit} submitLabel="Save client" />);
  fireEvent.click(screen.getByRole("button", { name: "Search clients" }));
  fireEvent.click(screen.getByRole("button", { name: "Save client" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  expect(screen.getByRole("option").matches(":disabled")).toBe(true);
  expect(screen.getByRole("combobox", { name: "Search clients" }).matches(":disabled")).toBe(true);
});


it("keeps email and phone validation visible after switching back to client search", async () => {
  render(<RecipientForm initialValues={{ mode: "named", name: "Jordan Taylor", email: "invalid", phone: "bad-number" }} onSubmit={vi.fn()} submitLabel="Save client" />);
  fireEvent.click(screen.getByRole("button", { name: "Search clients" }));
  fireEvent.click(screen.getByRole("button", { name: "Save client" }));
  const error = await screen.findByRole("alert");
  expect(error.textContent).toContain("Enter a valid email address");
  expect(error.textContent).toContain("Enter an Australian phone number");
  fireEvent.click(screen.getByRole("button", { name: "Review entered details" }));
  expect(screen.getByLabelText("Email (optional)")).toHaveProperty("value", "invalid");
});

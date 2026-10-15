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

it("preserves the entered customer name after a failed save and explains which details are public", async () => {
  let fail!: (error: Error) => void;
  const onSubmit = vi.fn<(values: RecipientValues) => Promise<void>>(() => new Promise<void>((_, reject) => { fail = reject; }));
  render(<RecipientForm initialValues={{ mode: "named", name: "", email: "", phone: "", contact_id: "" }} onSubmit={onSubmit} submitLabel="Save customer" />);
  const name = screen.getByLabelText("Customer name") as HTMLInputElement;
  fireEvent.change(name, { target: { value: "Jordan " } });
  expect(name.value).toBe("Jordan ");
  fireEvent.change(name, { target: { value: "Jordan Taylor" } });
  fireEvent.click(screen.getByRole("button", { name: "Save customer" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
  expect(name.closest("fieldset")?.disabled).toBe(true);
  await act(async () => fail(new Error("Connection lost. Please retry.")));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Connection lost. Please retry.");
  expect(name.value).toBe("Jordan Taylor");
  expect(name.closest("fieldset")?.disabled).toBe(false);
  expect(screen.getByText(/The customer name appears on the proposal/).textContent).toContain("Email and phone stay private");
  expect(onSubmit.mock.calls[0][0]).toMatchObject({ name: "Jordan Taylor" });
});

it("fills an existing customer and submits its identity", async () => {
  const contact = { id: "00000000-0000-4000-8000-000000000001", name: "Jordan Taylor", email: "jordan@example.com", phone: "0412345678" };
  contacts.data = [contact];
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<RecipientForm initialValues={{ mode: "named", name: "", email: "", phone: "" }} onSubmit={onSubmit} submitLabel="Save customer" />);
  fireEvent.change(screen.getByLabelText("Existing customer"), { target: { value: contact.id } });
  expect(screen.getByLabelText("Customer name")).toHaveProperty("value", contact.name);
  expect(screen.getByLabelText("Email (optional)")).toHaveProperty("value", contact.email);
  expect(screen.getByLabelText("Phone (optional)")).toHaveProperty("value", contact.phone);
  fireEvent.click(screen.getByRole("button", { name: "Save customer" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ mode: "named", contact_id: contact.id, name: contact.name, email: contact.email, phone: contact.phone }));
});

it("validates named customers and allows a general appraisal without contact fields", async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  render(<RecipientForm initialValues={{ mode: "named", name: "", email: "", phone: "" }} onSubmit={onSubmit} submitLabel="Create appraisal" />);
  fireEvent.click(screen.getByRole("button", { name: "Create appraisal" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Enter the customer's name.");
  expect(onSubmit).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Appraisal audience"), { target: { value: "general" } });
  expect(screen.queryByLabelText("Customer name")).toBeNull();
  expect(screen.getByText("No customer name will appear on the proposal. You can add a customer later.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Create appraisal" }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ mode: "general", name: "", email: "", phone: "" }));
});

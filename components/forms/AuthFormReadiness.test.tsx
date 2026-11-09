// @vitest-environment jsdom
import { renderToString } from "react-dom/server";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { signInWithPassword: mocks.signIn } }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it.each([LoginForm, SignupForm])("keeps prerendered auth controls disabled and never uses GET submission", Form => {
  const html = renderToString(<Form />);
  const dom = new DOMParser().parseFromString(html, "text/html");
  expect(dom.querySelector("form")?.method).toBe("post");
  expect(dom.querySelector("fieldset")?.disabled).toBe(true);
});

it("does not enable a Suspense fallback even after it hydrates", () => {
  render(<LoginForm pending />);
  expect(screen.getByLabelText("Email").closest("fieldset")?.disabled).toBe(true);
});

it("enables the hydrated form and signs in through the client handler", async () => {
  mocks.signIn.mockResolvedValue({ error: null });
  render(<LoginForm nextPath="/short-term-rentals" />);
  const email = screen.getByLabelText("Email");
  expect(email.closest("fieldset")?.disabled).toBe(false);
  fireEvent.change(email, { target: { value: "qa@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "synthetic-password" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in", exact: true }));
  await waitFor(() => expect(mocks.signIn).toHaveBeenCalledWith({ email: "qa@example.com", password: "synthetic-password" }));
  expect(mocks.push).toHaveBeenCalledWith("/short-term-rentals");
});

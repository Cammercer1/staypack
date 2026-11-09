// @vitest-environment jsdom
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AuthEntry } from "./AuthEntry";

const mocks = vi.hoisted(() => ({ getSession: vi.fn(), getUser: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }), useSearchParams: () => new URLSearchParams("redirectTo=%2Fshort-term-rentals") }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: mocks }) }));
vi.mock("./LoginForm", () => ({ LoginForm: () => <p>Sign in form</p> }));
vi.mock("./SignupForm", () => ({ SignupForm: () => <p>Sign up form</p> }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

it("does not make an auth network request for anonymous visitors", async () => {
  mocks.getSession.mockResolvedValue({ data: { session: null } });
  render(<AuthEntry mode="login" />);
  await waitFor(() => expect(mocks.getSession).toHaveBeenCalledOnce());
  expect(mocks.getUser).not.toHaveBeenCalled();
  expect(mocks.replace).not.toHaveBeenCalled();
});

it.each([true, false])("only redirects a locally signed-in user after verification: %s", async valid => {
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: "user" } } } });
  mocks.getUser.mockResolvedValue({ data: { user: valid ? { id: "user" } : null } });
  render(<AuthEntry mode="login" />);
  await waitFor(() => expect(mocks.getUser).toHaveBeenCalledOnce());
  if (valid) expect(mocks.replace).toHaveBeenCalledWith("/short-term-rentals");
  else expect(mocks.replace).not.toHaveBeenCalled();
});

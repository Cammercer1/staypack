// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { UnsavedListingGuard } from "./UnsavedListingGuard";
afterEach(cleanup);
it("blocks a navigation with unsaved changes and supports continuing to edit", () => {
  render(
    <>
      <UnsavedListingGuard dirty />
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Exercise the guard with a native navigation link. */}
      <a href="/listings">All listings</a>
    </>,
  );
  fireEvent.click(screen.getByText("All listings"));
  expect(
    screen.getByRole("dialog", { name: "Leave without saving?" }),
  ).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
it("warns before reload only while dirty", () => {
  const { rerender } = render(<UnsavedListingGuard dirty />);
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  rerender(<UnsavedListingGuard dirty={false} />);
  const clean = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(clean);
  expect(clean.defaultPrevented).toBe(false);
});

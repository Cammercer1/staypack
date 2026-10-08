// @vitest-environment jsdom
import { createElement } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ListingImageGallery } from "./ListingImageGallery";

afterEach(cleanup);

describe("listing photo gallery", () => {
  it("keeps the mobile button mounted through opening, closing and refreshed photos", () => {
    const props = { images: ["/one.jpg", "/two.jpg"], address: "Test listing" };
    const view = render(createElement(ListingImageGallery, props));
    const button = screen.getAllByRole("button", { name: /Show All Photos/ })[0];
    button.focus();
    fireEvent.click(button);
    expect(screen.getByText("2 photos · Test listing")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(document.activeElement).toBe(button);
    view.rerender(createElement(ListingImageGallery, { ...props, images: [...props.images, "/three.jpg"] }));
    expect(screen.getAllByRole("button", { name: /Show All Photos/ })[0]).toBe(button);
    fireEvent.click(button);
    expect(screen.getByText("3 photos · Test listing")).toBeTruthy();
  });
});

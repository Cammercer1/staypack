// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { DashboardOverview } from "./DashboardOverview";

afterEach(cleanup);

it("starts work in appraisals and keeps property marketing in Brochures", () => {
  render(<DashboardOverview agencyName="Agency" appraisals={[]} counts={{ draft: 4, ready: 2, published: 1 }} loadError={false} />);
  expect(screen.queryByRole("link", { name: "New listing" })).toBeNull();
  expect(screen.getByRole("link", { name: "New appraisal" }).getAttribute("href")).toBe("/appraisals/new");
  expect(screen.getByRole("link", { name: /Draft 4/ }).getAttribute("href")).toBe("/appraisals?status=draft");
  expect(screen.getByRole("link", { name: /Brochures.*Open brochures/ }).getAttribute("href")).toBe("/brochures");
});

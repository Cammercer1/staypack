// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Tabs } from "@base-ui/react/tabs";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { AppraisalWizardNavigation } from "./AppraisalWizardNavigation";

const steps = [{ id: "property", label: "Confirm property" }, { id: "proposal", label: "Check proposal" }];
afterEach(cleanup);

it.each([true, false])("keeps server-rendered steps disabled before hydration (native=%s)", native => {
  const navigation = <AppraisalWizardNavigation steps={steps} currentStep="property" label="Steps" onStepChange={native ? vi.fn() : undefined} />;
  const markup = renderToString(native ? navigation : <Tabs.Root value="property">{navigation}</Tabs.Root>);
  const container = document.createElement("div");
  container.innerHTML = markup;
  expect([...container.querySelectorAll("button")].every(button => button.disabled || button.getAttribute("aria-disabled") === "true")).toBe(true);
  expect(container.querySelectorAll("button")).toHaveLength(2);
});

it("enables hydrated steps and handles the first click", () => {
  const change = vi.fn();
  render(<AppraisalWizardNavigation steps={steps} currentStep="property" label="Steps" onStepChange={change} />);
  const step = screen.getByRole("button", { name: "2. Check proposal" }) as HTMLButtonElement;
  expect(step.disabled).toBe(false);
  fireEvent.click(step);
  expect(change).toHaveBeenCalledExactlyOnceWith("proposal");
});

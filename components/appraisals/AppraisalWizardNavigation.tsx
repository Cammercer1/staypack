"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { ArrowLeft, FileText } from "lucide-react";
import type { ReactNode } from "react";

type WorkflowStep = {
  id: string;
  label: string;
  disabled?: boolean;
};

export function AppraisalWizardNavigation({ steps, currentStep, label, onStepChange }: {
  steps: readonly WorkflowStep[];
  currentStep: string;
  label: string;
  onStepChange?: (step: string) => void;
}) {
  const List = onStepChange ? "nav" : TabsPrimitive.List;
  const StepControl = onStepChange ? NativeStep : TabsPrimitive.Tab;
  return (
    <List
      data-theme="staypack-workspace"
      aria-label={label}
      {...(!onStepChange ? { activateOnFocus: false } : {})}
      className={steps.length === 3
        ? "du-tabs du-tabs-box grid w-full min-w-0 grid-cols-3 gap-1 rounded-2xl border border-base-300 bg-base-200/70 p-1.5"
        : "du-tabs du-tabs-box grid w-full min-w-0 grid-cols-2 gap-1 rounded-2xl border border-base-300 bg-base-200/70 p-1.5 sm:grid-cols-4"}
    >
      {steps.map((item, index) => {
        const active = item.id === currentStep;
        return (
          <StepControl
            key={item.id}
            value={item.id}
            {...(onStepChange ? { onClick: () => onStepChange(item.id), "aria-current": active ? "step" as const : undefined, "aria-label": `${index + 1}. ${item.label}` } : {})}
            disabled={item.disabled}
            className={active
              ? "du-tab du-tab-active h-auto min-h-16 min-w-0 flex-col gap-1.5 rounded-xl bg-primary px-2 py-2 text-xs leading-tight font-medium text-primary-content transition-colors hover:text-primary-content focus-visible:outline-primary sm:min-h-12 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm"
              : "du-tab h-auto min-h-16 min-w-0 flex-col gap-1.5 rounded-xl px-2 py-2 text-xs leading-tight font-medium text-base-content/65 transition-colors hover:bg-base-100/70 hover:text-base-content focus-visible:outline-primary sm:min-h-12 sm:flex-row sm:gap-2 sm:px-3 sm:text-sm"}
          >
            <span aria-hidden="true" className={active
              ? "flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-content/15 text-xs text-primary-content tabular-nums"
              : "flex size-6 shrink-0 items-center justify-center rounded-full bg-base-100 text-xs text-base-content/55 tabular-nums"}>
              {index + 1}
            </span>
            <span className="whitespace-normal">{item.label}</span>
          </StepControl>
        );
      })}
    </List>
  );
}

function NativeStep({ value, children, ...props }: { value: string; children: ReactNode } & React.ComponentProps<"button">) {
  return <button type="button" value={value} {...props}>{children}</button>;
}

export function AppraisalStepGate({ message, onBack }: {
  message: string;
  onBack?: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-base-300 bg-base-100 px-5 py-10 text-center text-base-content">
      <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-base-200 text-base-content/60"><FileText className="size-5" aria-hidden="true" /></span>
      <p className="text-sm leading-relaxed text-base-content/65">{message}</p>
      {onBack ? <button type="button" className="du-btn du-btn-sm mt-5 min-h-11" onClick={onBack}><ArrowLeft className="size-4" aria-hidden="true" />Go back</button> : null}
    </div>
  );
}

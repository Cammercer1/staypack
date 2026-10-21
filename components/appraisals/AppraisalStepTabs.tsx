"use client";

import { Tabs } from "@base-ui/react/tabs";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AppraisalStepTabs({ label, value, onValueChange, tabs, disabled, children }: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  tabs: readonly { value: string; label: ReactNode; disabled?: boolean }[];
  disabled?: boolean;
  children: ReactNode;
}) {
  return <Tabs.Root data-theme="staypack-workspace" value={value} onValueChange={next => { if (!disabled && typeof next === "string") onValueChange(next); }} className="min-w-0 space-y-5 text-base-content">
    <Tabs.List aria-label={label} activateOnFocus className="du-tabs du-tabs-border flex-nowrap border-b border-base-300">
      {tabs.map(tab => <Tabs.Tab key={tab.value} value={tab.value} disabled={disabled || tab.disabled} className={cn("du-tab h-auto min-h-12 min-w-0 flex-1 px-3 py-3 text-sm leading-tight whitespace-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:flex-none sm:px-5", value === tab.value && "du-tab-active font-semibold text-primary")}>
        {tab.label}
      </Tabs.Tab>)}
    </Tabs.List>
    {children}
  </Tabs.Root>;
}

export function AppraisalStepPanel({ value, keepMounted = true, className, children }: {
  value: string;
  keepMounted?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return <Tabs.Panel value={value} keepMounted={keepMounted} className={cn("min-w-0 space-y-5 outline-none", className)}>{children}</Tabs.Panel>;
}

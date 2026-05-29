"use client";

import { Check, ChevronDown, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { LeadStatus } from "@/lib/types";

const STATUS_META: Record<
  LeadStatus,
  { label: string; dot: string; chip: string }
> = {
  new: {
    label: "New",
    dot: "bg-primary",
    chip: "bg-primary/10 text-primary ring-1 ring-inset ring-primary/20 hover:bg-primary/15",
  },
  contacted: {
    label: "Contacted",
    dot: "bg-muted-foreground/50",
    chip: "bg-muted text-muted-foreground ring-1 ring-inset ring-border hover:bg-muted/70",
  },
};

const STATUS_ORDER: LeadStatus[] = ["new", "contacted"];

export function leadStatusLabel(status: LeadStatus): string {
  return STATUS_META[status].label;
}

export function LeadStatusControl({
  status,
  onChange,
  updating = false,
  size = "default",
}: {
  status: LeadStatus;
  onChange: (status: LeadStatus) => void;
  updating?: boolean;
  size?: "default" | "sm";
}) {
  const meta = STATUS_META[status];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={updating}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60",
          size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm",
          meta.chip,
        )}
      >
        {updating ? (
          <Loader2 className="size-3 animate-spin" />
        ) : (
          <span className={cn("size-1.5 rounded-full", meta.dot)} />
        )}
        {meta.label}
        <ChevronDown className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36">
        {STATUS_ORDER.map((option) => (
          <DropdownMenuItem
            key={option}
            onClick={() => {
              if (option !== status) onChange(option);
            }}
            className="flex items-center justify-between gap-3"
          >
            <span className="flex items-center gap-2">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  STATUS_META[option].dot,
                )}
              />
              {STATUS_META[option].label}
            </span>
            {option === status ? <Check className="size-3.5" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

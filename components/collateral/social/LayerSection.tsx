"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trailing?: ReactNode;
  children: ReactNode;
};

export function LayerSection({
  title,
  description,
  open,
  onOpenChange,
  trailing,
  children,
}: Props) {
  return (
    <div className="group rounded-lg border border-border/60 bg-background/60">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
        >
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">{title}</span>
            {description ? (
              <span className="block text-xs text-muted-foreground">
                {description}
              </span>
            ) : null}
          </span>
        </button>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
      {open ? (
        <div className={cn("space-y-3 border-t border-border/50 px-3 py-3")}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

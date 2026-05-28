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
    <details
      open={open}
      className="group rounded-lg border border-border/60 bg-background/60"
    >
      <summary
        className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden"
        onClick={(e) => {
          e.preventDefault();
          onOpenChange(!open);
        }}
      >
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{title}</p>
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {trailing ? (
          <div className="shrink-0" onClick={(e) => e.preventDefault()}>
            {trailing}
          </div>
        ) : null}
      </summary>
      {open ? (
        <div className={cn("space-y-3 border-t border-border/50 px-3 py-3")}>
          {children}
        </div>
      ) : null}
    </details>
  );
}

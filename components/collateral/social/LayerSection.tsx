"use client";

import { useId, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  hidden?: boolean;
  collapsible?: boolean;
  description?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trailing?: ReactNode;
  children: ReactNode;
};

export function LayerSection({
  title,
  hidden = false,
  collapsible = true,
  description,
  open,
  onOpenChange,
  trailing,
  children,
}: Props) {
  const contentId = useId();
  if (hidden) return null;
  const expanded = !collapsible || open;
  return (
    <section className="border-b border-base-300 pb-5 last:border-0">
      <div className="flex min-h-11 items-center justify-between gap-3">
        {collapsible ? (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={contentId}
            onClick={() => onOpenChange(!open)}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded text-left focus-visible:outline-2 focus-visible:outline-primary"
          >
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-4 shrink-0 text-base-content/60 transition-transform",
                open && "rotate-180",
              )}
            />
            <span>
              <span className="block text-sm font-semibold">{title}</span>
              {description ? (
                <span className="mt-0.5 block text-xs text-base-content/60">
                  {description}
                </span>
              ) : null}
            </span>
          </button>
        ) : (
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{title}</h3>
            {description ? (
              <p className="mt-1 text-xs text-base-content/60">{description}</p>
            ) : null}
          </div>
        )}
        {trailing}
      </div>
      {expanded ? (
        <div id={contentId} className="space-y-4 pt-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}

"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  active: boolean;
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
};

export function AsyncLoadingOverlay({
  active,
  title,
  description,
  className,
  children,
}: Props) {
  return (
    <div className={cn("relative", className)}>
      {children}
      {active ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="mx-4 max-w-sm rounded-xl border border-border/70 bg-background px-6 py-5 text-center shadow-sm">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-sm font-medium">{title}</p>
            {description ? (
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SCRAPE_STEPS = [
  { label: "Reading listing URL", durationMs: 800 },
  { label: "Fetching property data", durationMs: 5000 },
  { label: "Extracting property details", durationMs: 3500 },
  { label: "Gathering photos", durationMs: 4000 },
  { label: "Loading agent details", durationMs: 3000 },
  { label: "Preparing your listing", durationMs: 8000 },
] as const;

type Props = {
  active: boolean;
  className?: string;
  children: ReactNode;
};

export function ListingScrapeProgress({ active, className, children }: Props) {
  const [stepIndex, setStepIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!active) {
      setStepIndex(0);
      return;
    }

    setStepIndex(0);

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;

    for (let i = 0; i < SCRAPE_STEPS.length - 1; i++) {
      elapsed += SCRAPE_STEPS[i].durationMs;
      timeouts.push(
        setTimeout(() => {
          setStepIndex((current) => Math.max(current, i + 1));
        }, elapsed),
      );
    }

    return () => {
      for (const timeout of timeouts) {
        clearTimeout(timeout);
      }
    };
  }, [active]);

  const progressPercent = Math.min(
    98,
    Math.round(((stepIndex + 0.4) / SCRAPE_STEPS.length) * 100),
  );

  const currentStep = SCRAPE_STEPS[stepIndex] ?? SCRAPE_STEPS[0];

  const overlay =
    active && mounted ? (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="w-full max-w-md rounded-xl border border-border/70 bg-background px-6 py-6 shadow-lg">
          <div className="flex items-center gap-3">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Importing listing</p>
              <p className="truncate text-sm text-muted-foreground">
                {currentStep.label}…
              </p>
            </div>
          </div>

          <div className="mt-5">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <ul className="mt-5 space-y-2.5">
            {SCRAPE_STEPS.map((step, index) => {
              const done = index < stepIndex;
              const current = index === stepIndex;

              return (
                <li
                  key={step.label}
                  className={cn(
                    "flex items-center gap-2.5 text-sm transition-colors",
                    done && "text-muted-foreground",
                    current && "font-medium text-foreground",
                    !done && !current && "text-muted-foreground/60",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                      done && "border-primary/30 bg-primary/10 text-primary",
                      current && "border-primary bg-primary/10",
                      !done && !current && "border-border bg-muted/40",
                    )}
                  >
                    {done ? (
                      <Check className="h-3 w-3" strokeWidth={2.5} />
                    ) : current ? (
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />
                    )}
                  </span>
                  {step.label}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    ) : null;

  return (
    <>
      <div className={className}>{children}</div>
      {overlay && typeof document !== "undefined"
        ? createPortal(overlay, document.body)
        : null}
    </>
  );
}

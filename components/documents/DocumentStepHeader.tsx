import type { ReactNode } from "react";

export function DocumentStepHeader({
  title,
  description,
  status,
  children,
}: {
  title: string;
  description: string;
  status?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header
      data-theme="staypack-workspace"
      className="sticky top-3 z-20 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-base-300 bg-base-100 p-4 text-base-content shadow-sm sm:p-5"
    >
      <div className="min-w-0 flex-1 basis-60">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {status}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
      {children ? (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          {children}
        </div>
      ) : null}
    </header>
  );
}

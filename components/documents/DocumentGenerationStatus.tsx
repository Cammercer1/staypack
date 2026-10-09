import { Check, FilePenLine, Loader2 } from "lucide-react";
import { DocumentStepHeader } from "@/components/documents/DocumentStepHeader";

export function DocumentGenerationStatus({
  title,
  description,
  headline,
  body,
  savedLabel,
  activeLabel,
}: {
  title: string;
  description: string;
  headline: string;
  body: string;
  savedLabel: string;
  activeLabel: string;
}) {
  return (
    <section
      data-theme="staypack-workspace"
      className="space-y-5"
      aria-busy="true"
    >
      <DocumentStepHeader title={title} description={description} />
      <div
        role="status"
        className="grid min-h-96 items-center gap-10 rounded-xl border border-base-300 bg-base-100 p-6 sm:p-10 lg:grid-cols-[1fr_1.3fr]"
      >
        <div className="space-y-6">
          <FilePenLine className="size-9" aria-hidden="true" />
          <div>
            <h3 className="text-2xl font-semibold tracking-tight">
              {headline}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {body}
            </p>
          </div>
          <div className="space-y-3 text-sm">
            <p className="flex gap-2">
              <Check className="size-4 text-primary" aria-hidden="true" />
              {savedLabel}
            </p>
            <p className="flex gap-2">
              <Loader2
                className="size-4 animate-spin text-primary"
                aria-hidden="true"
              />
              {activeLabel}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Usually 15–30 seconds. Keep this page open.
          </p>
        </div>
        <div
          aria-hidden="true"
          className="mx-auto w-full max-w-sm space-y-4 border border-base-300 bg-white p-6 shadow-sm"
        >
          <div className="du-skeleton h-5 w-1/3" />
          <div className="du-skeleton h-36 w-full" />
          <div className="du-skeleton h-7 w-4/5" />
          <div className="du-skeleton h-3 w-full" />
          <div className="du-skeleton h-3 w-full" />
          <div className="du-skeleton h-3 w-2/3" />
        </div>
      </div>
    </section>
  );
}

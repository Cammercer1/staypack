import Link from "next/link";
import { Plus } from "lucide-react";

export function WorkspaceHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 max-w-3xl">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-base-content/65">
          {eyebrow}
        </p>
        <h1 className="text-3xl text-base-content sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-base-content/70 sm:text-base">
          {description}
        </p>
      </div>
      <Link
        href="/listings/new"
        prefetch={false}
        className="du-btn du-btn-primary min-h-11 shrink-0 self-start sm:self-auto"
      >
        <Plus className="size-4" aria-hidden="true" />
        New listing
      </Link>
    </header>
  );
}

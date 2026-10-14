import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { creationOptions, creationPath } from "@/lib/properties/creation";
import { CreationIllustration } from "./CreationIllustration";

export function CreateOptions({ listingId, appraisalsOnly = false }: { listingId?: string; appraisalsOnly?: boolean }) {
  return <div className="space-y-8">
    {(appraisalsOnly ? ["Appraisals"] : ["Appraisals", "Marketing"]).map(group => <section key={group} aria-label={group}>
      <div className="mb-4 flex items-center gap-4">
        <h2 className="text-sm font-semibold text-base-content/70">{group}</h2>
        <div aria-hidden="true" className="h-px flex-1 bg-base-300" />
      </div>
      <ul className={group === "Appraisals" ? "grid gap-4 md:grid-cols-3" : "grid gap-4 sm:grid-cols-2"}>
        {creationOptions.filter(option => option.group === group).map(option => <li key={option.id} className="min-w-0">
          <Link
            href={creationPath(option.path, listingId)}
            aria-labelledby={`create-${option.id}-title`}
            aria-describedby={`create-${option.id}-description`}
            className={group === "Appraisals"
              ? "du-card group h-full overflow-hidden rounded-2xl border border-base-300 bg-base-100 text-base-content transition-[border-color,box-shadow] duration-300 hover:border-primary/40 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary motion-safe:hover:-translate-y-1 motion-safe:transition-[transform,border-color,box-shadow]"
              : "du-card group h-full flex-row overflow-hidden rounded-2xl border border-base-300 bg-base-100 text-base-content transition-[border-color,box-shadow] duration-300 hover:border-primary/40 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary motion-safe:hover:-translate-y-1 motion-safe:transition-[transform,border-color,box-shadow]"}
          >
            <div className={group === "Appraisals" ? "flex h-44 shrink-0 items-center justify-center overflow-hidden bg-accent/65 px-3" : "flex w-28 shrink-0 items-center justify-center overflow-hidden bg-base-200 px-2 lg:w-32"}>
              <CreationIllustration kind={option.id} />
            </div>
            <div className={group === "Appraisals" ? "du-card-body min-w-0 gap-3 p-5 lg:p-6" : "du-card-body min-w-0 gap-3 p-5"}>
              <h3 id={`create-${option.id}-title`} className="du-card-title font-display text-xl leading-tight font-medium lg:text-2xl">{option.label}</h3>
              <p id={`create-${option.id}-description`} className="text-sm leading-relaxed text-base-content/65">{option.description}</p>
              <div className="du-card-actions mt-2 items-center justify-between gap-2 text-primary" aria-hidden="true">
                <span className="text-xs font-semibold">{group === "Appraisals" ? "Create appraisal" : option.id === "brochure" ? "Create brochure" : "Create post"}</span>
                <span className="flex size-8 items-center justify-center rounded-full bg-accent text-accent-content transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-content group-focus-visible:bg-primary group-focus-visible:text-primary-content"><ArrowUpRight className="size-4" /></span>
              </div>
            </div>
          </Link>
        </li>)}
      </ul>
    </section>)}
  </div>;
}

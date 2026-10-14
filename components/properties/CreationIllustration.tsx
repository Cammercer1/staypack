import { Building2, Check, Heart, House, KeyRound, MessageCircle, Sun } from "lucide-react";
import type { creationOptions } from "@/lib/properties/creation";

type CreationKind = (typeof creationOptions)[number]["id"];

/** Decorative previews of the deliverables, not sample appraisal data. */
export function CreationIllustration({ kind }: { kind: CreationKind }) {
  if (kind === "str") return (
    <div aria-hidden="true" className="relative h-36 w-56 text-primary">
      <div className="absolute left-5 top-5 h-28 w-40 -rotate-6 rounded-lg border border-primary/10 bg-base-100 p-4 shadow-md motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:-rotate-3 motion-safe:group-focus-visible:-rotate-3">
        <div className="flex items-center justify-between"><span className="font-display text-sm">Rental potential</span><House className="size-4" strokeWidth={1.5} /></div>
        <div className="mt-4 flex h-12 items-end gap-2 border-b border-primary/15 pb-1">
          <span className="h-3 w-4 rounded-t-sm bg-primary/20" /><span className="h-5 w-4 rounded-t-sm bg-primary/30" /><span className="h-4 w-4 rounded-t-sm bg-primary/40" /><span className="h-8 w-4 rounded-t-sm bg-primary/65" /><span className="h-10 w-4 rounded-t-sm bg-primary" />
        </div>
      </div>
      <div className="absolute right-2 top-2 flex size-14 rotate-12 items-center justify-center rounded-full border-4 border-base-100 bg-accent text-accent-content shadow-sm motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:rotate-0 motion-safe:group-focus-visible:rotate-0"><Sun className="size-7" strokeWidth={1.5} /></div>
      <div className="absolute bottom-0 right-2 rounded-md border border-primary/10 bg-base-100 px-3 py-1.5 text-xs shadow-sm">Short stays</div>
    </div>
  );

  if (kind === "lease") return (
    <div aria-hidden="true" className="relative h-36 w-56 text-primary">
      <div className="absolute left-5 top-2 h-32 w-32 rotate-4 rounded-lg border border-primary/10 bg-base-100 p-4 shadow-md motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:rotate-1 motion-safe:group-focus-visible:rotate-1">
        <span className="font-display text-sm">Rental guide</span>
        <div className="mt-4 space-y-2.5">{[0, 1, 2].map(row => <div key={row} className="flex items-center gap-2"><Check className="size-3" /><span className="h-1.5 flex-1 rounded-full bg-primary/15" /></div>)}</div>
      </div>
      <div className="absolute bottom-3 right-4 flex size-20 -rotate-12 items-center justify-center rounded-2xl border-4 border-base-100 bg-primary text-primary-content shadow-md motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:-translate-y-1 motion-safe:group-hover:-rotate-6 motion-safe:group-focus-visible:-translate-y-1"><KeyRound className="size-10" strokeWidth={1.25} /></div>
    </div>
  );

  if (kind === "sales") return (
    <div aria-hidden="true" className="relative h-36 w-56 text-primary">
      <div className="absolute left-4 top-4 h-28 w-40 -rotate-3 rounded-lg border border-primary/10 bg-base-100 p-3.5 shadow-md motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:rotate-0 motion-safe:group-focus-visible:rotate-0">
        <span className="font-display text-sm">Market snapshot</span>
        <div className="mt-3 flex gap-2">{[0, 1, 2].map(home => <div key={home} className="flex-1"><div className="flex h-10 items-center justify-center rounded bg-accent text-accent-content"><House className="size-5" strokeWidth={1.5} /></div><div className="mt-2 h-1 rounded-full bg-primary/20" /></div>)}</div>
      </div>
      <div className="absolute bottom-1 right-1 rotate-8 rounded-md border-4 border-base-100 bg-primary px-4 py-2 font-display text-lg text-primary-content shadow-md motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:rotate-3 motion-safe:group-focus-visible:rotate-3">For sale</div>
    </div>
  );

  if (kind === "brochure") return (
    <div aria-hidden="true" className="relative h-36 w-32 text-primary">
      <div className="absolute left-3 top-4 h-28 w-20 -rotate-12 rounded border border-primary/10 bg-base-100 shadow-sm" />
      <div className="absolute left-7 top-3 h-28 w-20 rotate-12 rounded border border-primary/10 bg-base-100 shadow-sm" />
      <div className="absolute left-5 top-2 h-28 w-20 -rotate-3 overflow-hidden rounded border border-primary/10 bg-base-100 shadow-md motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:rotate-0 motion-safe:group-focus-visible:rotate-0">
        <div className="flex h-17 items-center justify-center bg-primary text-primary-content"><Building2 className="size-9" strokeWidth={1} /></div>
        <div className="px-2 pt-2 font-display text-xs leading-tight">Meet your<br />next home.</div>
      </div>
    </div>
  );

  return (
    <div aria-hidden="true" className="relative h-36 w-32 text-primary">
      <div className="absolute right-0 top-3 h-28 w-16 rotate-12 rounded-lg border-[3px] border-base-100 bg-primary/20 shadow-sm"><div className="mx-auto mt-2 h-1 w-5 rounded-full bg-primary/30" /></div>
      <div className="absolute left-0 top-7 w-24 -rotate-8 overflow-hidden rounded-lg border-[3px] border-base-100 bg-base-100 shadow-md motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:-rotate-3 motion-safe:group-focus-visible:-rotate-3">
        <div className="flex h-17 items-center justify-center bg-primary text-primary-content"><House className="size-9" strokeWidth={1.25} /></div>
        <div className="flex items-center gap-1.5 px-1 py-1.5"><Heart className="size-3" /><MessageCircle className="size-3" /><span className="ml-auto h-1 w-5 rounded-full bg-primary/20" /></div>
      </div>
    </div>
  );
}

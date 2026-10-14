import Image from "next/image";
import { Compass, HeartHandshake, House, MessagesSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProposalData } from "@/lib/digital-proposals/data";
import type { ProposalService } from "@/lib/digital-proposals/service";
import { resolveTokenText } from "@/lib/digital-proposals/tokens";

const icons = { strategy: Compass, care: House, hospitality: HeartHandshake, communication: MessagesSquare };

export function ProposalManagementService({ service, data, motion }: { service: ProposalService; data: ProposalData; motion: boolean }) {
  const text = (value: string) => resolveTokenText(value, data).text;
  return <section aria-labelledby="management-service-heading" className={cn("min-w-0", motion && "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-700")}>
    <div className="grid items-stretch gap-7 @min-[800px]/proposal:grid-cols-[0.9fr_1.1fr] @min-[800px]/proposal:gap-12">
      <div className="flex min-w-0 flex-col justify-center @min-[800px]/proposal:order-2">
        <p className="text-xs font-semibold tracking-[0.16em] text-(--proposal-muted) uppercase">{text(service.eyebrow)}</p>
        <h1 id="management-service-heading" tabIndex={-1} className="mt-4 whitespace-pre-line font-[family-name:var(--proposal-heading)] text-[clamp(2.15rem,4.2cqi,4.25rem)] leading-[1.08] tracking-tight [overflow-wrap:anywhere]">{text(service.headline)}</h1>
        <p className="mt-5 max-w-xl text-pretty text-sm leading-relaxed text-(--proposal-muted) @min-[600px]/proposal:text-base">{text(service.introduction)}</p>
        {service.proof && <div className="mt-6 flex items-start gap-5 border-t border-current/15 pt-5">
          <div className="shrink-0"><p className="font-[family-name:var(--proposal-heading)] text-3xl leading-tight tracking-tight">{text(service.proof.value)}</p><p className="mt-1 max-w-28 text-xs leading-relaxed text-(--proposal-muted)">{text(service.proof.label)}</p></div>
          <p className="max-w-sm text-xs leading-relaxed text-(--proposal-muted) @min-[600px]/proposal:text-sm">{text(service.proof.body)}</p>
        </div>}
      </div>
      <figure className="relative isolate min-w-0 overflow-hidden bg-(--proposal-surface) @min-[800px]/proposal:order-1">
        {service.imageUrl && <Image unoptimized loading="eager" src={service.imageUrl} alt={text(service.imageAlt)} width={1000} height={800} className="h-[clamp(11rem,38cqi,19rem)] w-full object-cover @min-[800px]/proposal:h-[clamp(20rem,42dvh,26rem)]" />}
        {service.imageCaption && <figcaption className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-6 pt-12 pb-5 text-xs font-medium tracking-wide text-white">{text(service.imageCaption)}</figcaption>}
      </figure>
    </div>
    <div className="mt-8 grid gap-x-7 gap-y-5 @min-[600px]/proposal:grid-cols-2 @min-[1100px]/proposal:mt-10 @min-[1100px]/proposal:grid-cols-4">
      {service.highlights.map((item, index) => {
        const Icon = icons[item.icon];
        return <div key={index} className="flex min-w-0 gap-4 border-t border-current/15 pt-4 @min-[600px]/proposal:block">
          <Icon size={23} strokeWidth={1.5} aria-hidden="true" className="mt-0.5 shrink-0 text-(--proposal-primary)" />
          <div><h2 className="font-[family-name:var(--proposal-body)] text-base leading-snug font-semibold @min-[600px]/proposal:mt-3">{text(item.title)}</h2>
          <p className="mt-2 text-sm leading-relaxed text-(--proposal-muted)">{text(item.body)}</p></div>
        </div>;
      })}
    </div>
  </section>;
}

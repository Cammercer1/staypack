import Image from "next/image";
import { House, LockKeyhole } from "lucide-react";
import type { ProposalData } from "@/lib/digital-proposals/data";
import type { ProposalDraft } from "@/lib/digital-proposals/template";
import { resolveTokenText } from "@/lib/digital-proposals/tokens";

export function ProposalCoverSummary({ data, draft }: { data: ProposalData; draft: ProposalDraft }) {
  const title = resolveTokenText(draft.content.title, data).text;
  const subtitle = resolveTokenText(draft.content.introduction, data).text;
  const recipient = resolveTokenText(draft.content.recipientLine, data).text;

  return <section aria-label="Proposal cover" className="overflow-hidden rounded-2xl border border-base-300 bg-base-100">
    <div className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
      <h3 className="font-semibold">Proposal cover</h3>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-base-200 px-2.5 py-1 text-xs text-base-content/65"><LockKeyhole size={12} aria-hidden="true" />Automatic</span>
    </div>
    <div className="relative flex h-36 items-center justify-center overflow-hidden bg-base-200">
      {data.property.heroImageUrl ? <Image unoptimized src={data.property.heroImageUrl} alt="" fill loading="eager" sizes="(min-width: 1024px) 380px, 100vw" className="object-cover" /> : <House size={36} className="text-base-content/25" aria-hidden="true" />}
    </div>
    <div className="space-y-3 p-5 sm:p-6">
      <div role="group" aria-label="Proposal introduction">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-base-content/55">{data.agency.name}</p>
        <h4 className="mt-2 break-words text-xl font-semibold leading-snug tracking-tight">{title}</h4>
        {subtitle && <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-base-content/75">{subtitle}</p>}
        {recipient && <p className="mt-1 whitespace-pre-line text-sm text-base-content/65 first-letter:uppercase">{recipient}</p>}
      </div>
      <p className="border-t border-base-300 pt-3 text-xs leading-relaxed text-base-content/55">Your agency’s cover wording is applied automatically. Property and customer details stay in sync.</p>
    </div>
  </section>;
}

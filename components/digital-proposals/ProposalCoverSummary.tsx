import Image from "next/image";
import { House, Images } from "lucide-react";
import type { ProposalData } from "@/lib/digital-proposals/data";
export function ProposalCoverSummary({ data, onEditPhotos, disabled }: { data: ProposalData; onEditPhotos?: () => void; disabled?: boolean }) {
  const photoCount = new Set([data.property.heroImageUrl, ...data.property.gallery].filter(Boolean)).size;
  return <section aria-label="Proposal cover" className="du-card relative isolate min-h-80 min-w-0 overflow-hidden rounded-2xl border border-base-300 bg-neutral text-neutral-content">
    <div className="absolute inset-0 flex items-center justify-center">
      {data.property.heroImageUrl ? <Image unoptimized src={data.property.heroImageUrl} alt="Current proposal cover photo" fill loading="eager" sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" /> : <House size={48} className="text-neutral-content/35" aria-hidden="true" />}
    </div>
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-linear-to-b from-neutral/85 via-neutral/5 to-neutral/75" />
    <div className="du-card-body relative justify-between gap-6 p-5 sm:p-6">
      <div className="space-y-1">
        <h3 className="du-card-title text-base">Cover photo</h3>
        <p className="text-xs leading-relaxed">{photoCount ? `${photoCount} photo${photoCount === 1 ? "" : "s"} selected` : "Choose a photo to introduce your proposal"}</p>
      </div>
      {onEditPhotos && <div className="du-card-actions">
        <button type="button" className="du-btn du-btn-sm h-auto min-h-11 w-full whitespace-normal py-3" disabled={disabled} onClick={onEditPhotos}><Images size={16} className="shrink-0" aria-hidden="true" />Change cover photo</button>
      </div>}
    </div>
  </section>;
}

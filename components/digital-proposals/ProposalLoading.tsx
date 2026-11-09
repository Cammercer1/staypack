import Image from "next/image";
import type { LoadingBrand } from "@/lib/digital-proposals/loadingBrand";

/** No property, recipient, estimate or StayPack branding belongs in this public shell. */
export function ProposalLoading({ brand }: { brand: LoadingBrand | null }) {
  return <div role="status" aria-label="Loading proposal" aria-live="polite" aria-busy="true"
    data-testid="proposal-loading"
    className="fixed inset-0 z-50 flex min-h-dvh flex-col items-center justify-center gap-8 px-8"
    style={{ backgroundColor: brand?.primary ?? "#ffffff", color: brand?.primaryText ?? "#333333" }}>
    {brand?.logoUrl ? <div className="flex min-h-24 max-w-[85vw] items-center justify-center rounded-lg bg-white px-7 py-5">
      <Image src={brand.logoUrl} alt={brand.name} width={320} height={110} unoptimized preload
        className="h-auto max-h-24 w-64 max-w-[65vw] object-contain" />
    </div> : brand && <span className="text-2xl font-medium">{brand.name}</span>}
    <span aria-hidden="true" className="size-5 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin" />
    <span className="sr-only">Loading proposal</span>
  </div>;
}

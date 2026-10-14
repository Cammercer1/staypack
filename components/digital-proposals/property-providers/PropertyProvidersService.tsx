import Image from "next/image";
import { Star } from "lucide-react";
import type { ProposalService } from "@/lib/digital-proposals/service";

const platforms = [
  { name: "Stayz", file: "stayz", width: 86 },
  { name: "RateMyAgent", file: "ratemyagent", width: 119 },
  { name: "Vrbo", file: "vrbo", width: 78 },
  { name: "Expedia", file: "expedia", width: 107 },
  { name: "Airbnb", file: "airbnb", width: 98 },
  { name: "Google", file: "google", width: 85 },
];

export function PropertyProvidersService({ service, theme = "property-providers" }: { service: ProposalService; theme?: "property-providers" | "agency-proposal" }) {
  return <section data-theme={theme} aria-label="Our management service"
    className="grid gap-8 bg-base-100 text-base-content [--primary:var(--color-primary)] min-[761px]:grid-cols-[.9fr_1.1fr] min-[1101px]:gap-14">
    <div className="flex min-w-0 flex-col">
      <figure className="relative min-h-64 flex-1 overflow-hidden max-[760px]:aspect-[4/3]">
        <Image src={service.imageUrl} alt={service.imageAlt} fill unoptimized loading="eager"
          sizes="(max-width: 760px) 100vw, 42vw" className={theme === "agency-proposal" ? "object-cover object-[center_70%]" : "object-cover"} />
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-neutral/80 to-transparent px-6 pb-5 pt-12 text-[11px] text-neutral-content">
          {service.imageCaption}
        </figcaption>
      </figure>
      {service.proof && <aside aria-label="Ratings and review platforms" className="bg-base-200 px-6 pb-6 pt-5">
        <div className="du-stats grid w-full grid-cols-[auto_1fr] items-center gap-6 overflow-visible rounded-none bg-transparent text-base-content shadow-none">
          <div className="du-stat min-w-0 border-0 p-0">
            <div className="du-stat-value flex items-center gap-2 text-[38px] font-normal tracking-tight text-primary">
              {service.proof.value}<Star size={21} fill="currentColor" strokeWidth={0} aria-hidden="true" />
            </div>
            <div className="du-stat-title mt-1 whitespace-normal text-[11px] text-base-content/75">{service.proof.label}</div>
          </div>
          <div className="du-stat min-w-0 border-0 border-l border-base-300 py-1 pl-6 pr-0">
            <p className="du-stat-desc whitespace-normal text-[14px] leading-relaxed text-base-content">{service.proof.body}</p>
          </div>
        </div>
        <ul aria-label="Review platforms" className="mt-6 grid grid-cols-3 items-center gap-x-5 gap-y-5">
          {(service.platforms?.map(platform => ({ ...platform, file: platform.name, width: 110 })) ?? platforms.map(platform => ({ ...platform, imageUrl: `/brands/property-providers/platforms/${platform.file}.svg` }))).map(platform => <li key={platform.file} className="flex h-7 min-w-0 items-center justify-center">
            <Image src={platform.imageUrl} alt={platform.name}
              width={platform.width} height={30} unoptimized className="max-h-7 max-w-full object-contain grayscale opacity-70" />
          </li>)}
        </ul>
      </aside>}
      {!service.proof && Boolean(service.platforms?.length) && <div className="bg-base-200 px-6 py-6">
        <ul aria-label="Booking platforms" className="grid grid-cols-3 items-center gap-5">
          {service.platforms?.map(platform => <li key={platform.name} className="flex h-8 min-w-0 items-center justify-center">
            <Image src={platform.imageUrl} alt={platform.name} width={110} height={32} unoptimized
              className="max-h-8 max-w-full object-contain grayscale opacity-75" />
          </li>)}
        </ul>
      </div>}
    </div>
    <div className="min-w-0 self-center">
      <h1 tabIndex={-1} className="whitespace-pre-line text-[32px]! min-[1101px]:text-[40px]! min-[1450px]:text-[46px]!">{service.headline}</h1>
      <p className="pt-5 text-[13px] leading-relaxed text-base-content/75">{service.introduction}</p>
      <ol className="mt-6 divide-y divide-base-300 border-t border-base-300">
        {service.highlights.map((item, i) => <li key={item.title} className="flex gap-5 py-4">
          <span className="pt-0.5 text-xs text-primary" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
          <div><h2 className="text-[13px] font-medium">{item.title}</h2>
            <p className="pt-1 text-xs leading-relaxed text-base-content/75">{item.body}</p></div>
        </li>)}
      </ol>
    </div>
  </section>;
}

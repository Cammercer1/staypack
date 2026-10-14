"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ChartNoAxesCombined,
  Check,
  FileText,
  Menu,
  PanelsTopLeft,
  X,
} from "lucide-react";
import { StayPackLogo } from "@/components/app-shell/StayPackLogo";

const navigation = [
  ["The collection", "#product"],
  ["How it works", "#how-it-works"],
  ["Your brand", "#your-brand"],
  ["Pricing", "#pricing"],
] as const;

export function HomeNavigation() {
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  return (
    <header
      className="border-b border-base-content/15"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          toggle.current?.focus();
        }
      }}
    >
      <div className="mx-auto flex min-h-24 max-w-7xl items-center justify-between gap-5 px-6 sm:px-10 lg:px-14">
        <StayPackLogo href="/" height={27} />
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-7 text-sm lg:flex"
        >
          {navigation.map(([label, href]) => (
            <a
              key={href}
              href={href}
              className="flex min-h-11 items-center underline-offset-4 hover:underline"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-5">
          <Link
            href="/login"
            className="hidden min-h-11 items-center text-sm hover:underline sm:flex"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="du-btn du-btn-primary hidden min-h-11 rounded-full px-5 text-sm font-medium shadow-none sm:inline-flex"
          >
            Get started
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <button
            ref={toggle}
            type="button"
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={open ? "Close navigation" : "Open navigation"}
            onClick={() => setOpen(!open)}
            className="du-btn du-btn-ghost du-btn-square min-h-11 lg:hidden"
          >
            {open ? (
              <X size={22} aria-hidden="true" />
            ) : (
              <Menu size={22} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
      <nav
        id="mobile-navigation"
        aria-label="Mobile navigation"
        hidden={!open}
        className="border-t border-base-content/15 px-6 pb-6 lg:hidden"
      >
        {navigation.map(([label, href]) => (
          <a
            key={href}
            href={href}
            onClick={() => setOpen(false)}
            className="flex min-h-12 items-center justify-between border-b border-base-content/10 text-sm"
          >
            {label}
            <ArrowUpRight size={15} aria-hidden="true" />
          </a>
        ))}
        <div className="mt-5 flex items-center gap-6">
          <Link
            href="/signup"
            className="du-btn du-btn-primary min-h-11 rounded-full px-6 shadow-none"
          >
            Get started
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <Link
            href="/login"
            className="flex min-h-11 items-center text-sm underline"
          >
            Log in
          </Link>
        </div>
      </nav>
    </header>
  );
}

const products = [
  {
    id: "appraisals",
    name: "Sales & rental appraisals",
    icon: ChartNoAxesCombined,
    title: "Put your expertise on the page.",
    description:
      "Present a considered price or rental range, selected comparable properties and the local insight that makes your advice worth listening to.",
    details: [
      "Sales and rental evidence",
      "Your commentary and recommendations",
      "Branded PDF and online report",
    ],
    format: "Appraisals",
  },
  {
    id: "brochures",
    name: "Property brochures",
    icon: FileText,
    title: "Something worth taking home.",
    description:
      "Bring your photography, property story and agent details into a beautifully arranged brochure for open homes, inspections and the follow-up.",
    details: [
      "Property and rental brochures",
      "Layouts that carry your agency identity",
      "Ready to download and share",
    ],
    format: "Brochures",
  },
  {
    id: "social",
    name: "Social media posts",
    icon: PanelsTopLeft,
    title: "A familiar face in the feed.",
    description:
      "Carry the same property story onto social. Choose your format, adjust the imagery and copy, and create posts that feel unmistakably like your agency.",
    details: [
      "Editable imagery, text and layers",
      "Formats for your social channels",
      "Consistent agency branding",
    ],
    format: "Social posts",
  },
  {
    id: "str",
    name: "Short-term rental proposals",
    icon: ChartNoAxesCombined,
    title: "Make the opportunity clear.",
    description:
      "Review estimated gross STR revenue and comparable market evidence. Then bring your appraisal, service and next steps together in a digital proposal.",
    details: [
      "A dedicated STR appraisal workspace",
      "Reviewable assumptions and comparables",
      "Branded reports and digital proposals",
    ],
    format: "STR proposals",
  },
] as const;

function SampleOutput({ selected }: { selected: number }) {
  if (selected === 0) {
    return (
      <div className="flex w-full max-w-md items-center justify-center gap-3 py-5 sm:gap-5">
        <Image
          src="/marketing/staypack-rental-appraisal-front.webp"
          alt="Sample rental appraisal with property details and indicative rent"
          width={992}
          height={1404}
          sizes="(max-width: 640px) 42vw, 220px"
          className="w-[52%] -rotate-3 border border-base-content/10 shadow-lg shadow-neutral/10"
        />
        <Image
          src="/marketing/staypack-rental-appraisal-comparables.webp"
          alt="Sample appraisal’s comparable rental evidence page"
          width={986}
          height={1400}
          sizes="(max-width: 640px) 34vw, 175px"
          className="w-[42%] rotate-3 border border-base-content/10 shadow-lg shadow-neutral/10"
        />
      </div>
    );
  }
  if (selected === 1) {
    return (
      <div className="w-full max-w-xs bg-base-100 p-5 shadow-lg shadow-neutral/10">
        <p className="flex justify-between border-b border-base-content/25 pb-4 text-xs">
          <span>Your agency.</span>
          <span>Property collection</span>
        </p>
        <p className="py-6 font-display text-4xl leading-none">
          A little more
          <br />
          room to live.
        </p>
        <Image
          src="/marketing/property-interior.webp"
          alt="Living space in an illustrative property brochure"
          width={1000}
          height={680}
          sizes="320px"
          className="aspect-[4/3] w-full object-cover"
        />
        <div className="flex justify-between pt-5 text-xs">
          <span>Discover the details.</span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </div>
      </div>
    );
  }
  if (selected === 2) {
    return (
      <div className="w-full max-w-xs overflow-hidden bg-primary text-primary-content shadow-lg shadow-neutral/10">
        <div className="flex justify-between px-5 py-4 text-xs">
          <span>Your agency.</span>
          <span>JUST LISTED</span>
        </div>
        <Image
          src="/marketing/property-exterior.webp"
          alt="Sample just-listed social post featuring a contemporary home"
          width={1600}
          height={1067}
          sizes="320px"
          className="aspect-square w-full object-cover"
        />
        <div className="flex items-center justify-between p-5">
          <p className="font-display text-3xl">A new chapter.</p>
          <ArrowUpRight size={22} aria-hidden="true" />
        </div>
      </div>
    );
  }
  return (
    <div className="w-full max-w-sm bg-base-100 p-6 shadow-lg shadow-neutral/10">
      <div className="flex items-center justify-between border-b border-base-content/20 pb-4 text-xs">
        <span>Your agency.</span>
        <span>STR APPRAISAL</span>
      </div>
      <p className="mt-6 font-display text-3xl leading-tight">
        Your property.
        <br />A clearer picture.
      </p>
      <p className="mt-4 text-xs leading-relaxed text-base-content/70">
        Estimated gross STR revenue, grounded in the available market evidence.
      </p>
      <ol className="mt-6 space-y-0">
        {[
          "Property & assumptions",
          "Market evidence",
          "Your management service",
          "Next steps",
        ].map((item, index) => (
          <li
            key={item}
            className="flex items-center gap-3 border-t border-base-content/15 py-4 text-sm"
          >
            <span className="text-xs tabular-nums text-primary">
              0{index + 1}
            </span>
            {item}
            <Check size={14} className="ml-auto" aria-hidden="true" />
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ProductExplorer() {
  const [selected, setSelected] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const product = products[selected];

  function moveTab(
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let next: number;
    if (event.key === "ArrowDown" || event.key === "ArrowRight")
      next = (index + 1) % products.length;
    else if (event.key === "ArrowUp" || event.key === "ArrowLeft")
      next = (index - 1 + products.length) % products.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = products.length - 1;
    else return;
    event.preventDefault();
    setSelected(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-12">
      <div
        role="tablist"
        aria-label="Property presentation formats"
        aria-orientation="vertical"
        className="border-t border-base-content/20"
      >
        {products.map((item, index) => {
          const Icon = item.icon;
          return (
            <button
              type="button"
              role="tab"
              id={`product-tab-${item.id}`}
              aria-selected={selected === index}
              aria-controls={`product-panel-${item.id}`}
              tabIndex={selected === index ? 0 : -1}
              ref={(node) => {
                tabs.current[index] = node;
              }}
              onKeyDown={(event) => moveTab(event, index)}
              onClick={() => setSelected(index)}
              key={item.id}
              className="group flex min-h-20 w-full items-center gap-4 border-b border-base-content/20 px-2 py-5 text-left transition-colors hover:bg-base-200 aria-selected:bg-accent aria-selected:text-accent-content motion-reduce:transition-none"
            >
              <span className="text-xs tabular-nums opacity-65">
                0{index + 1}
              </span>
              <Icon
                size={18}
                strokeWidth={1.5}
                className="hidden shrink-0 sm:block"
                aria-hidden="true"
              />
              <span className="flex-1 text-base font-medium">{item.name}</span>
              <ArrowUpRight
                size={19}
                className={selected === index ? "opacity-100" : "opacity-40"}
                aria-hidden="true"
              />
            </button>
          );
        })}
        <p className="mt-5 text-xs leading-relaxed text-base-content/65">
          Explore the formats. Make them your own.
        </p>
      </div>
      {products.map((item, index) => (
        <div
          key={item.id}
          role="tabpanel"
          id={`product-panel-${item.id}`}
          aria-labelledby={`product-tab-${item.id}`}
          hidden={selected !== index}
          tabIndex={0}
          className="min-w-0 focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          {selected === index && (
            <>
              <div className="relative flex h-[530px] items-center justify-center bg-base-200 px-7 pt-10 pb-8">
                <span className="absolute top-4 left-5 text-xs tracking-wide text-base-content/65">
                  {product.format.toUpperCase()}
                </span>
                <SampleOutput selected={selected} />
                <span className="absolute right-4 bottom-3 text-xs text-base-content/60">
                  Illustrative preview
                </span>
              </div>
              <div className="pt-7">
                <h3 className="font-display text-3xl tracking-tight">
                  {product.title}
                </h3>
                <p className="mt-3 max-w-xl text-sm leading-7 text-base-content/75">
                  {product.description}
                </p>
                <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
                  {product.details.map((detail) => (
                    <li
                      className="flex items-center gap-2 text-xs"
                      key={detail}
                    >
                      <Check
                        size={13}
                        className="text-primary"
                        aria-hidden="true"
                      />
                      {detail}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/signup"
                  className="mt-5 inline-flex min-h-11 items-center gap-3 text-sm font-medium underline-offset-4 hover:underline"
                >
                  Create with StayPack
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

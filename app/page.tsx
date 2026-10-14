import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  FileText,
  Link as LinkIcon,
  Palette,
  Plus,
  Users,
} from "lucide-react";
import { StayPackLogo } from "@/components/app-shell/StayPackLogo";
import {
  HomeNavigation,
  ProductExplorer,
} from "@/components/marketing/HomeInteractions";

export const metadata: Metadata = {
  title: { absolute: "StayPack | Every property. Beautifully presented." },
  description:
    "Create branded property appraisals, brochures, social posts and digital short-term rental proposals. Your property knowledge, beautifully presented in your agency’s brand.",
  // Preserve the existing launch indexing policy.
  robots: {
    index: false,
    follow: false,
    googleBot: { index: false, follow: false },
  },
};

const container = "mx-auto w-full max-w-7xl px-6 sm:px-10 lg:px-14";
const primaryButton =
  "du-btn du-btn-primary min-h-12 rounded-full px-6 text-sm font-medium shadow-none";
const textLink =
  "inline-flex min-h-11 items-center gap-3 text-sm font-medium underline-offset-4 hover:underline";
const questions = [
  {
    question: "What can I create with StayPack?",
    answer:
      "Sales and rental appraisals, property and rental brochures, social media posts, and short-term rental appraisals. The dedicated short-term rental workspace also brings your evidence, services and next steps together in a branded digital proposal.",
  },
  {
    question: "Will it look like our agency?",
    answer:
      "Yes. Add your logo, colours and agent details, then choose from the available designs. If your agency needs a more tailored presentation, talk to us about a custom template and brand setup.",
  },
  {
    question: "Can I review the details before sharing?",
    answer:
      "Absolutely. Review the property details, imagery, copy and available comparable evidence, then make adjustments before publishing. If a listing import is missing something, you can enter it yourself.",
  },
  {
    question: "How does the monthly report allowance work?",
    answer:
      "The agency plan includes 30 first-published reports per month, shared by your team. Additional reports are A$5 each, plus GST. Editing or downloading an already published report does not count as another report. Publishing a duplicated appraisal counts as a new report.",
  },
  {
    question: "Are short-term rental estimates guaranteed?",
    answer:
      "No. Estimated gross STR revenue is indicative and depends on the available data and assumptions. It excludes operating costs and is not a valuation or income guarantee. Reports include a disclaimer, and owners should make their own enquiries and seek independent advice.",
  },
];

function HeroFolio() {
  return (
    <figure className="mt-12 sm:mt-16">
      <div className="grid gap-0 lg:grid-cols-[1fr_280px]">
        <div className="relative min-w-0 bg-base-200">
          <Image
            src="/marketing/property-exterior.webp"
            alt="Contemporary home framed by trees at dusk"
            width={1600}
            height={1067}
            sizes="(max-width: 1024px) 100vw, 850px"
            loading="eager"
            fetchPriority="high"
            className="h-80 w-full object-cover sm:h-[450px]"
          />
          <div className="absolute bottom-5 left-5 bg-base-100 px-4 py-3 text-base-content sm:bottom-7 sm:left-7">
            <p className="text-xs tracking-[0.14em] uppercase">
              A place worth presenting.
            </p>
            <p className="mt-1 font-display text-2xl">
              Make the first impression count.
            </p>
          </div>
          <div className="absolute -right-6 top-8 hidden w-52 rotate-6 bg-base-100 p-3 text-base-content shadow-xl shadow-neutral/20 motion-safe:transition-transform motion-safe:duration-300 hover:rotate-0 sm:block lg:-right-4 lg:w-56">
            <p className="flex items-center justify-between pb-3 text-xs font-medium">
              <span>Your agency.</span>
              <span>01 / 04</span>
            </p>
            <Image
              src="/marketing/property-interior.webp"
              alt="Sample brochure featuring a light-filled living room"
              width={1000}
              height={680}
              sizes="224px"
              loading="eager"
              className="aspect-[4/3] w-full object-cover"
            />
            <p className="mt-4 font-display text-3xl leading-none">
              Room to
              <br />
              imagine.
            </p>
            <p className="mt-3 border-t border-base-content/20 pt-3 text-xs">
              Property brochure · Sample design
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-base-content/20 pt-3 text-xs">
              <span>Prepared in your brand</span>
              <ArrowUpRight size={15} aria-hidden="true" />
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-between bg-primary p-7 text-primary-content sm:p-9 lg:pl-14">
          <p className="font-display text-3xl leading-tight">
            One property.
            <br />
            <em>So much possibility.</em>
          </p>
          <ul className="mt-7 grid grid-cols-2 gap-x-5 gap-y-3 text-sm lg:grid-cols-1">
            {[
              "Appraisals",
              "Brochures",
              "Social posts",
              "Digital proposals",
            ].map((label, i) => (
              <li className="flex items-center gap-3" key={label}>
                <span className="text-xs tabular-nums opacity-65">
                  0{i + 1}
                </span>
                {label}
              </li>
            ))}
          </ul>
          <a
            href="#product"
            className="mt-8 flex min-h-11 items-center justify-between border-t border-primary-content/30 pt-5 text-sm hover:underline"
          >
            Explore the collection
            <ArrowRight size={18} aria-hidden="true" />
          </a>
        </div>
      </div>
      <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-base-content/65">
        <span>PROPERTY MARKETING, CONSIDERED FROM EVERY ANGLE.</span>
        <span>Illustrative property &amp; design</span>
      </figcaption>
    </figure>
  );
}

function ProposalPreview() {
  return (
    <figure className="relative min-w-0">
      <div className="overflow-hidden rounded-lg border border-primary-content/25 bg-base-100 text-base-content shadow-xl shadow-neutral/20">
        <div className="flex items-center justify-between border-b border-base-300 px-5 py-3 text-xs">
          <span className="font-medium">Your agency.</span>
          <span className="flex items-center gap-2">
            <LinkIcon size={13} aria-hidden="true" /> Digital proposal
          </span>
        </div>
        <div className="grid sm:grid-cols-[1.05fr_1fr]">
          <Image
            src="/marketing/proposal-property.webp"
            alt="Poolside property featured in a sample digital proposal"
            width={1600}
            height={1061}
            sizes="(max-width: 640px) 100vw, 350px"
            className="h-48 w-full object-cover sm:h-full"
          />
          <div className="p-6 sm:py-9">
            <p className="text-xs text-base-content/65">
              PREPARED FOR THE PROPERTY OWNER
            </p>
            <p className="mt-4 font-display text-3xl leading-tight">
              A considered plan
              <br />
              for your property.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-base-content/75">
              The opportunity. The evidence. The people who will look after it.
            </p>
            <div className="mt-6 border-t border-base-300 pt-4 text-xs">
              {[
                "Estimated gross STR revenue",
                "Comparable properties",
                "Your management service",
              ].map((item) => (
                <p
                  key={item}
                  className="flex items-center justify-between gap-2 py-2"
                >
                  {item}
                  <Check size={14} className="shrink-0" aria-hidden="true" />
                </p>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-between gap-2 border-t border-base-300 px-5 py-4 text-xs">
          <span>Property → Evidence → Your service → Next steps</span>
          <span className="text-base-content/65">Sample presentation</span>
        </div>
      </div>
      <figcaption className="mt-4 text-xs text-primary-content/75">
        A shareable proposal, with your agency at the centre.
      </figcaption>
    </figure>
  );
}

export default function HomePage() {
  return (
    <div
      data-theme="staypack-workspace"
      className="min-h-screen bg-base-100 text-base-content selection:bg-primary selection:text-primary-content [&_a:focus-visible]:outline-2 [&_a:focus-visible]:outline-offset-4 [&_button:focus-visible]:outline-2 [&_button:focus-visible]:outline-offset-4 [&_summary:focus-visible]:outline-2 [&_summary:focus-visible]:outline-offset-4"
    >
      <a
        href="#main-content"
        className="sr-only z-50 bg-base-100 p-4 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <HomeNavigation />
      <main id="main-content">
        <section
          className="mx-auto w-full max-w-7xl px-6 sm:px-10 lg:px-14 pt-14 pb-10 sm:pt-20 sm:pb-14"
          aria-labelledby="hero-heading"
        >
          <div className="grid items-end gap-8 lg:grid-cols-[1.6fr_1fr] lg:gap-16">
            <h1
              id="hero-heading"
              className="font-display text-5xl leading-[1.03] font-normal tracking-[-0.045em] sm:text-7xl lg:text-[80px] xl:text-[88px]"
            >
              <span className="block">Every property.</span>
              <span className="block text-primary">
                <em>Beautifully</em>
              </span>
              <span className="block">presented.</span>
            </h1>
            <div className="max-w-md pb-1 lg:pb-3">
              <p className="text-lg leading-relaxed text-base-content/80">
                Turn your property knowledge into appraisals, brochures, social
                posts and digital proposals. All together. All in your brand.
              </p>
              <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
                <Link href="/signup" className={primaryButton}>
                  Get started
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
                <a href="#product" className={textLink}>
                  See what you can create
                  <ChevronDown size={15} aria-hidden="true" />
                </a>
              </div>
              <p className="mt-5 text-xs text-base-content/65">
                Made for real estate agencies &amp; property managers.
              </p>
            </div>
          </div>
          <HeroFolio />
        </section>
        <div className="border-y border-base-content/15">
          <div className="mx-auto w-full max-w-7xl px-6 sm:px-10 lg:px-14 grid gap-4 py-6 text-sm sm:grid-cols-3 sm:gap-6">
            <p className="flex items-center gap-3">
              <FileText size={18} strokeWidth={1.5} aria-hidden="true" /> One
              property record, more possibilities
            </p>
            <p className="flex items-center gap-3">
              <Palette size={18} strokeWidth={1.5} aria-hidden="true" /> Your
              brand, down to the details
            </p>
            <p className="flex items-center gap-3">
              <Users size={18} strokeWidth={1.5} aria-hidden="true" /> A
              consistent standard for every agent
            </p>
          </div>
        </div>
        <section
          id="product"
          className="mx-auto w-full max-w-7xl px-6 sm:px-10 lg:px-14 scroll-mt-8 py-20 sm:py-28"
          aria-labelledby="product-heading"
        >
          <div className="mb-12 grid gap-6 lg:grid-cols-[1.35fr_1fr] lg:gap-24">
            <h2
              id="product-heading"
              className="max-w-xl font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl"
            >
              From the first appraisal
              <br className="hidden sm:block" /> to the final impression.
            </h2>
            <p className="max-w-md self-end text-base leading-relaxed text-base-content/75">
              The details are already there. Make more of them. Bring the
              property, evidence and your expertise together in material you’re
              proud to put your name on.
            </p>
          </div>
          <ProductExplorer />
        </section>
        <section
          id="how-it-works"
          className="scroll-mt-8 bg-base-200 py-20 sm:py-24"
          aria-labelledby="workflow-heading"
        >
          <div className={container}>
            <div className="grid gap-7 lg:grid-cols-[1fr_1.1fr] lg:gap-24">
              <h2
                id="workflow-heading"
                className="font-display text-4xl leading-[1.12] tracking-tight sm:text-5xl"
              >
                Less starting over.
                <br />
                <em>More moving forward.</em>
              </h2>
              <p className="max-w-lg self-end leading-relaxed text-base-content/75">
                No more copying the same address, hunting for the right photo,
                or rebuilding a document. Start with the property. Keep your
                expertise in the process.
              </p>
            </div>
            <ol className="mt-14 grid gap-9 md:grid-cols-3 md:gap-10">
              {[
                [
                  "01",
                  "Bring the property.",
                  "Start with a listing URL, an address or the details you already have. Review the facts and choose your imagery.",
                ],
                [
                  "02",
                  "Make it your own.",
                  "Choose your format and design. Review the copy, adjust the evidence and add the local knowledge only you have.",
                ],
                [
                  "03",
                  "Make an impression.",
                  "Preview the finished result. Download your material or publish a report or proposal link, ready for the next conversation.",
                ],
              ].map(([number, title, copy]) => (
                <li
                  key={number}
                  className="border-t border-base-content/25 pt-5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-3xl text-primary">
                      {number}
                    </span>
                    <ArrowRight
                      size={18}
                      strokeWidth={1.5}
                      aria-hidden="true"
                    />
                  </div>
                  <h3 className="mt-6 text-lg font-medium">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-base-content/75">
                    {copy}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section
          id="digital-proposals"
          className="scroll-mt-8 bg-primary py-20 text-primary-content sm:py-28"
          aria-labelledby="proposal-heading"
        >
          <div className="mx-auto w-full max-w-7xl px-6 sm:px-10 lg:px-14 grid items-center gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
            <div>
              <h2
                id="proposal-heading"
                className="font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl"
              >
                More than an estimate.
                <br />
                <em>A reason to choose you.</em>
              </h2>
              <p className="mt-7 max-w-md leading-relaxed text-primary-content/80">
                Give short-term rental owners the full picture. Turn your
                appraisal into a digital proposal that brings the property’s
                potential, your service and the next steps together.
              </p>
              <ul className="mt-7 space-y-4 text-sm">
                {[
                  "Estimated gross STR revenue and comparable evidence",
                  "Your team, management service and supporting documents",
                  "A branded link that’s ready to share",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check
                      size={16}
                      className="mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/signup"
                className="mt-8 inline-flex min-h-12 items-center gap-4 border-b border-primary-content/60 text-sm font-medium hover:border-primary-content"
              >
                Create your first proposal
                <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
            </div>
            <ProposalPreview />
          </div>
        </section>
        <section
          id="your-brand"
          className="mx-auto w-full max-w-7xl px-6 sm:px-10 lg:px-14 grid gap-12 py-20 sm:py-28 lg:grid-cols-2 lg:gap-24"
          aria-labelledby="brand-heading"
        >
          <div className="flex flex-col justify-center">
            <h2
              id="brand-heading"
              className="font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl"
            >
              Your agency has a look.
              <br />
              <em>Let’s keep it that way.</em>
            </h2>
            <p className="mt-7 max-w-lg leading-relaxed text-base-content/75">
              Your logo. Your colours. Your people. StayPack brings your
              identity into every new document, so the whole team can create
              with the same level of care.
            </p>
            <a
              href="mailto:hello@staypack.app?subject=StayPack%20brand%20setup"
              className="inline-flex min-h-11 items-center gap-3 text-sm font-medium underline-offset-4 hover:underline mt-7 self-start"
            >
              Talk to us about your brand
              <ArrowUpRight size={17} aria-hidden="true" />
            </a>
          </div>
          <div className="border border-base-content/20 p-7 sm:p-10">
            <div className="flex items-center justify-between border-b border-base-content/20 pb-5">
              <p className="text-sm font-medium">
                The essentials, beautifully connected.
              </p>
              <Palette size={20} strokeWidth={1.5} aria-hidden="true" />
            </div>
            <div className="grid grid-cols-[1fr_auto] items-center gap-5 py-7">
              <p className="font-display text-5xl tracking-tight">
                Aa<span className="ml-3 font-sans text-3xl">Aa</span>
              </p>
              <div
                className="flex -space-x-2"
                aria-label="StayPack’s cream, sage and forest palette"
              >
                <span className="size-10 rounded-full border border-base-content/20 bg-base-200" />
                <span className="size-10 rounded-full border border-base-content/20 bg-accent" />
                <span className="size-10 rounded-full border border-base-content/20 bg-primary" />
              </div>
            </div>
            <p className="text-xs text-base-content/65">
              Typography, colour and layouts that feel like you.
            </p>
            <ul className="mt-7 border-t border-base-content/20">
              {[
                "Agency branding & template designs",
                "Agent details & team consistency",
                "Custom design setup available",
              ].map((item) => (
                <li
                  key={item}
                  className="flex justify-between gap-4 border-b border-base-content/15 py-4 text-sm"
                >
                  {item}
                  <Check
                    size={16}
                    className="shrink-0 text-primary"
                    aria-hidden="true"
                  />
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section
          id="pricing"
          className="scroll-mt-8 border-y border-base-content/15 bg-base-200 py-20 sm:py-24"
          aria-labelledby="pricing-heading"
        >
          <div className="mx-auto w-full max-w-7xl px-6 sm:px-10 lg:px-14 grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-24">
            <div>
              <h2
                id="pricing-heading"
                className="max-w-md font-display text-4xl leading-[1.1] tracking-tight sm:text-5xl"
              >
                One agency.
                <br />
                <em>One shared plan.</em>
              </h2>
              <p className="mt-7 max-w-sm leading-relaxed text-base-content/75">
                A monthly home for your team’s property presentations. A shared
                report allowance, with room for the busier months.
              </p>
              <p className="mt-6 text-sm font-medium">
                No setup fee for the standard plan.
              </p>
            </div>
            <div className="du-card rounded-none border border-base-content/20 bg-base-100 shadow-none">
              <div className="du-card-body gap-0 p-7 sm:p-10">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-medium">Agency</h3>
                  <span className="du-badge du-badge-sm du-badge-outline rounded-none">
                    Monthly plan
                  </span>
                </div>
                <p className="mt-6 flex flex-wrap items-baseline gap-x-3">
                  <span className="font-display text-6xl tracking-tight tabular-nums">
                    A$199
                  </span>
                  <span className="text-sm text-base-content/70">
                    / month + GST
                  </span>
                </p>
                <ul className="mt-7 space-y-4 border-t border-base-content/20 pt-6 text-sm">
                  {[
                    "30 published reports included each month",
                    "One allowance shared across your agency",
                    "Additional reports at A$5 each + GST",
                    "Edits and downloads of published reports included",
                  ].map((item) => (
                    <li key={item} className="flex gap-3">
                      <Check
                        size={16}
                        className="shrink-0 text-primary"
                        aria-hidden="true"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="du-card-actions mt-8">
                  <Link
                    href="/signup"
                    className="du-btn du-btn-primary min-h-12 rounded-full px-6 text-sm font-medium shadow-none w-full"
                  >
                    Get started
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </Link>
                </div>
                <p className="mt-4 text-center text-xs text-base-content/65">
                  Need a custom agency design?{" "}
                  <a
                    className="underline underline-offset-2"
                    href="mailto:hello@staypack.app?subject=Custom%20StayPack%20design"
                  >
                    Let’s talk.
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>
        <section
          className="mx-auto w-full max-w-7xl px-6 sm:px-10 lg:px-14 grid gap-9 py-20 sm:py-24 lg:grid-cols-[0.7fr_1.3fr] lg:gap-24"
          aria-labelledby="faq-heading"
        >
          <div>
            <h2
              id="faq-heading"
              className="font-display text-4xl tracking-tight"
            >
              A few good questions.
            </h2>
            <p className="mt-5 text-sm text-base-content/75">
              Something else on your mind?
            </p>
            <a href="mailto:hello@staypack.app" className={textLink}>
              Say hello
              <ArrowUpRight size={16} aria-hidden="true" />
            </a>
          </div>
          <div className="border-t border-base-content/20">
            {questions.map(({ question, answer }) => (
              <details
                name="homepage-faq"
                key={question}
                className="group border-b border-base-content/20"
              >
                <summary className="flex min-h-18 cursor-pointer items-center justify-between gap-5 py-5 text-base font-medium [&::-webkit-details-marker]:hidden">
                  {question}
                  <Plus
                    size={18}
                    className="shrink-0 transition-transform group-open:rotate-45 motion-reduce:transition-none"
                    aria-hidden="true"
                  />
                </summary>
                <p className="max-w-xl pb-6 pr-6 text-sm leading-7 text-base-content/75">
                  {answer}
                </p>
              </details>
            ))}
          </div>
        </section>
        <section
          className="mx-auto w-full max-w-7xl px-6 sm:px-10 lg:px-14 pb-20 sm:pb-24"
          aria-labelledby="closing-heading"
        >
          <div className="flex flex-col justify-between gap-8 border-t border-base-content/25 pt-12 sm:flex-row sm:items-end">
            <h2
              id="closing-heading"
              className="max-w-2xl font-display text-4xl leading-[1.1] tracking-tight sm:text-6xl"
            >
              Your next property.
              <br />
              <em className="text-primary">Your best presentation.</em>
            </h2>
            <Link
              href="/signup"
              className="du-btn du-btn-primary min-h-12 rounded-full px-6 text-sm font-medium shadow-none self-start sm:mb-2 sm:self-end"
            >
              Let’s make it a StayPack
              <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>
      <footer className="border-t border-base-content/15 bg-base-200">
        <div className="mx-auto w-full max-w-7xl px-6 sm:px-10 lg:px-14 py-10">
          <div className="flex flex-col justify-between gap-7 sm:flex-row sm:items-start">
            <div>
              <StayPackLogo href="/" height={25} />
              <p className="mt-4 text-sm text-base-content/75">
                Property marketing, beautifully together.
              </p>
            </div>
            <nav
              aria-label="Footer navigation"
              className="flex flex-wrap gap-x-6 gap-y-3 text-sm"
            >
              <a href="#product" className="min-h-11 hover:underline">
                The collection
              </a>
              <a href="#pricing" className="min-h-11 hover:underline">
                Pricing
              </a>
              <a
                href="mailto:hello@staypack.app"
                className="min-h-11 hover:underline"
              >
                Contact
              </a>
              <Link href="/login" className="min-h-11 hover:underline">
                Log in
              </Link>
            </nav>
          </div>
          <div className="mt-9 flex flex-col justify-between gap-4 border-t border-base-content/15 pt-6 text-xs leading-relaxed text-base-content/65">
            <p>© {new Date().getFullYear()} StayPack.</p>
            <p className="max-w-3xl">
              Estimated gross STR revenue is indicative only, excludes operating
              costs and is not a valuation or income guarantee. Property imagery
              and presentation previews on this page are illustrative.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

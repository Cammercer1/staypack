import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Check,
  ChevronRight,
  Globe2,
  KeyRound,
  LayoutTemplate,
  Palette,
  Quote,
  ScanLine,
  Share2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
  MapPinned,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { StayPackLogo } from "@/components/app-shell/StayPackLogo";
import styles from "./home.module.css";

export const metadata: Metadata = {
  title: "StayPack | Branded property collateral, without the design bottleneck",
  description:
    "Turn a property listing into branded landing pages, appraisals, brochures, social posts and data-backed property collateral.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

const PROPERTY_IMAGE =
  "https://i2.au.reastatic.net/1000x750-format=webp/422520a544404447b3705e0c4c61557f6cb3a7c7da5aec3419311d8ad31e329a/image.jpg";

type ProductOutput = {
  icon: LucideIcon;
  label: string;
  title: string;
  copy: string;
  accent: string;
  number: string;
  status?: "Coming soon";
};

const outputs: ProductOutput[] = [
  {
    icon: BarChart3,
    label: "Branded STR appraisals",
    title: "Make the potential tangible.",
    copy: "Create buyer-friendly reports that combine property details, market evidence and a clearly labelled estimated gross STR revenue.",
    accent: "mint",
    number: "01",
  },
  {
    icon: KeyRound,
    label: "Branded lease appraisals",
    title: "Present the rental opportunity clearly.",
    copy: "Package the weekly rent range, comparable evidence and your property management proposition into one polished appraisal.",
    accent: "apricot",
    number: "02",
  },
  {
    icon: TrendingUp,
    label: "Branded sales appraisals",
    title: "Walk into every pitch better prepared.",
    copy: "Bring the property story, price guidance and relevant sales evidence together in a presentation built to win confidence.",
    accent: "blue",
    number: "03",
  },
  {
    icon: LayoutTemplate,
    label: "Branded property brochures",
    title: "One source. Every useful format.",
    copy: "Turn approved listing details and imagery into beautifully branded brochures, with social assets and live pages ready to follow.",
    accent: "gold",
    number: "04",
  },
  {
    icon: Share2,
    label: "Branded social media posts",
    title: "Keep every listing recognisable in the feed.",
    copy: "Turn the same approved property imagery and copy into on-brand social posts across the formats your agents use most.",
    accent: "lavender",
    number: "05",
  },
  {
    icon: MapPinned,
    label: "Branded suburb profiles",
    title: "Package the local knowledge buyers value.",
    copy: "Bring lifestyle, amenity and market context into a reusable local-area profile that looks and feels like your agency.",
    accent: "coral",
    number: "06",
    status: "Coming soon",
  },
];

const benefits = [
  {
    icon: Palette,
    title: "Always on brand",
    copy: "Lock in your colours, typography, logos and layouts once. Every new pack starts agency-ready.",
  },
  {
    icon: Zap,
    title: "No design queue",
    copy: "Give agents a repeatable way to produce high-quality material without waiting on a designer for every listing.",
  },
  {
    icon: ShieldCheck,
    title: "Evidence, handled carefully",
    copy: "Clear methodology and compliant language keep estimates useful, transparent and grounded in available data.",
  },
  {
    icon: Users,
    title: "Built for the whole agency",
    copy: "Create once, keep the logic consistent, and let every agent work from the same approved system.",
  },
];

function ArrowLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link className={styles.arrowLink} href={href}>
      {children}
      <ArrowRight aria-hidden="true" size={16} strokeWidth={2} />
    </Link>
  );
}

function ReportArtwork() {
  return (
    <div className={styles.previewStage} aria-label="A branded StayPack report pack preview">
      <div className={styles.previewOrb} />

      <div className={styles.reportPages}>
        <figure className={`${styles.reportPage} ${styles.reportPageBack}`}>
          <figcaption>Evidence · page 02</figcaption>
          <Image
            src="/marketing/staypack-rental-appraisal-comparables.webp"
            alt="Comparable rental evidence page from a StayPack rental appraisal"
            width={986}
            height={1400}
            sizes="(max-width: 640px) 47vw, (max-width: 900px) 300px, 305px"
          />
        </figure>

        <figure className={`${styles.reportPage} ${styles.reportPageFront}`}>
          <figcaption>Appraisal · page 01</figcaption>
          <Image
            src="/marketing/staypack-rental-appraisal-front.webp"
            alt="Front page of a branded StayPack rental appraisal"
            width={992}
            height={1404}
            sizes="(max-width: 640px) 58vw, (max-width: 900px) 330px, 330px"
            fetchPriority="high"
          />
        </figure>
      </div>

      <div className={styles.browserCard} aria-hidden="true">
        <div className={styles.browserBar}>
          <span />
          <span />
          <span />
          <div>staypack.app/north-and-co/42-ocean-parade</div>
        </div>
        <div className={styles.browserContent}>
          <span>REPORT WORKSPACE</span>
          <strong>Review, publish and share in one place.</strong>
          <div className={styles.browserButton}>Open report preview</div>
        </div>
      </div>

      <div className={`${styles.floatTag} ${styles.floatTagTop}`}>
        <span className={styles.floatIcon}><Check size={14} strokeWidth={3} /></span>
        Brand system applied
      </div>
      <div className={`${styles.floatTag} ${styles.floatTagBottom}`}>
        <Sparkles size={15} />
        Report pack ready
      </div>
    </div>
  );
}

function MiniPackPreview() {
  return (
    <div className={styles.packPreview} aria-hidden="true">
      <div className={styles.packSidebar}>
        <StayPackLogo href={undefined} height={17} />
        <div className={styles.packSidebarLine} />
        <div className={styles.packSidebarLine} />
        <div className={styles.packSidebarLine} />
      </div>
      <div className={styles.packWorkspace}>
        <div className={styles.packWorkspaceTop}>
          <div>
            <small>LISTING WORKSPACE</small>
            <strong>42 Ocean Parade</strong>
          </div>
          <span>Complete</span>
        </div>
        <div className={styles.packItems}>
          <div><BarChart3 size={18} /><span>STR potential report</span><Check size={15} /></div>
          <div><KeyRound size={18} /><span>Lease appraisal</span><Check size={15} /></div>
          <div><TrendingUp size={18} /><span>Sales appraisal</span><Check size={15} /></div>
          <div><LayoutTemplate size={18} /><span>Property brochure</span><Check size={15} /></div>
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <main className={styles.page}>
      <header className={styles.siteHeader}>
        <div className={styles.headerInner}>
          <StayPackLogo href="/" height={26} />
          <nav className={styles.desktopNav} aria-label="Main navigation">
            <a href="#product">Product</a>
            <a href="#how-it-works">How it works</a>
            <a href="#solutions">For agencies</a>
            <a href="#pricing">Pricing</a>
          </nav>
          <div className={styles.headerActions}>
            <Link className={styles.loginLink} href="/login">Log in</Link>
            <Link className={styles.headerCta} href="/signup">
              Create a report
              <ArrowRight aria-hidden="true" size={15} />
            </Link>
          </div>
          <details className={styles.mobileMenu}>
            <summary aria-label="Open navigation">
              <span />
              <span />
            </summary>
            <nav aria-label="Mobile navigation">
              <a href="#product">Product</a>
              <a href="#how-it-works">How it works</a>
              <a href="#solutions">For agencies</a>
              <a href="#pricing">Pricing</a>
              <Link href="/login">Log in</Link>
              <Link className={styles.mobileMenuCta} href="/signup">Create a report</Link>
            </nav>
          </details>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>
              <span><Sparkles size={13} /></span>
              Property marketing, packed.
            </div>
            <h1>
              Picture-perfect
              <br />property collateral.
              <br /><em>No designer or data scientist required.</em>
            </h1>
            <p className={styles.heroLead}>
              Turn one listing into branded property pages with lead capture,
              sales and lease appraisals, brochures, social posts and
              data-backed STR potential reports—all from one property record.
            </p>
            <div className={styles.heroActions}>
              <Link className={styles.primaryButton} href="/signup">
                Create your first report
                <ArrowRight aria-hidden="true" size={18} />
              </Link>
              <a className={styles.secondaryButton} href="#product">
                See what you can create
              </a>
            </div>
            <div className={styles.heroProof}>
              <span><Check size={14} /> No specialist team required</span>
              <span><Check size={14} /> Free branded preview</span>
              <span><Check size={14} /> Publish when ready</span>
            </div>
          </div>
          <ReportArtwork />
        </div>
      </section>

      <section className={styles.proofStrip} aria-label="StayPack capabilities">
        <div className={styles.proofStripInner}>
          <p>One listing in.</p>
          <div><Globe2 size={17} /> Listing page + lead capture</div>
          <div><TrendingUp size={17} /> Sales &amp; lease appraisals</div>
          <div><LayoutTemplate size={17} /> Brochures + social posts</div>
          <div><BarChart3 size={17} /> STR potential reports</div>
          <p>A complete pack out.</p>
        </div>
      </section>

      <section className={styles.transformationSection} id="product">
        <div className={styles.sectionInner}>
          <div className={styles.sectionIntro}>
            <p className={styles.kicker}>YOUR PROPERTY CONTENT SYSTEM</p>
            <h2>Stop rebuilding the same listing, over and over.</h2>
            <p>
              Add the property once. StayPack keeps the details, imagery,
              evidence and brand system together—then turns them into every
              format your team needs.
            </p>
          </div>

          <div className={styles.transformationGrid}>
            <div className={styles.inputCard}>
              <div className={styles.cardTopline}>
                <span>01</span>
                <span>THE INPUT</span>
              </div>
              <div className={styles.urlField}>
                <ScanLine size={18} />
                <span>realestate.com.au/property...</span>
                <button type="button" tabIndex={-1}>Import</button>
              </div>
              <div className={styles.inputDetails}>
                <div className={styles.inputImage}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={PROPERTY_IMAGE} alt="" />
                </div>
                <div>
                  <small>PROPERTY FOUND</small>
                  <strong>42 Ocean Parade</strong>
                  <span>Burleigh Heads, QLD</span>
                  <div className={styles.miniPills}><i>4 bed</i><i>2 bath</i><i>2 car</i></div>
                </div>
              </div>
            </div>

            <div className={styles.transformArrow} aria-hidden="true">
              <ArrowRight />
            </div>

            <div className={styles.outputCard}>
              <div className={styles.cardTopline}>
                <span>02</span>
                <span>THE OUTPUT</span>
              </div>
              <MiniPackPreview />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.outputSection}>
        <div className={styles.sectionInner}>
          <div className={styles.outputHeading}>
            <div>
              <p className={styles.kicker}>A COMPLETE PROPERTY CONTENT SUITE</p>
              <h2>Give every property conversation a better story.</h2>
            </div>
            <p>
              From an STR opportunity or lease appraisal to a sales pitch and
              finished brochure, social post or local-area profile, keep every
              touchpoint useful, credible and beautifully consistent.
            </p>
          </div>

          <div className={styles.outputCards}>
            {outputs.map((output) => {
              const Icon = output.icon;
              return (
                <article className={`${styles.outputFeature} ${styles[output.accent]}`} key={output.label}>
                  <div className={styles.outputNumber}>{output.number}</div>
                  <div className={styles.outputIcon}><Icon size={21} /></div>
                  <p className={styles.outputLabel}>{output.label}</p>
                  <h3>{output.title}</h3>
                  <p className={styles.outputCopy}>{output.copy}</p>
                  {output.status ? (
                    <span className={styles.outputStatus}>{output.status}</span>
                  ) : (
                    <a href="#examples" aria-label={`See ${output.label.toLowerCase()} examples`}>
                      View examples <ChevronRight size={15} />
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className={styles.benefitsSection}>
        <div className={styles.sectionInner}>
          <div className={styles.benefitsLayout}>
            <div className={styles.benefitsStatement}>
              <p className={styles.kicker}>DESIGNED TO DISAPPEAR INTO YOUR WORKFLOW</p>
              <h2>The polish of a studio. The speed of a system.</h2>
              <p>
                StayPack takes care of the repetitive production work, so your
                team can stay focused on the property, the vendor and the next
                conversation.
              </p>
              <figure className={styles.handoverFigure}>
                <Image
                  src="/marketing/businessman-presenting-brochure.webp"
                  alt="Real estate agent presenting a branded property brochure to a client"
                  width={1536}
                  height={1024}
                  sizes="(max-width: 900px) calc(100vw - 40px), 460px"
                />
                <figcaption>
                  <span>FROM SCREEN TO FRONT DOOR</span>
                  <strong>Beautifully prepared for the conversations that matter.</strong>
                </figcaption>
              </figure>
              <div className={styles.quoteCard}>
                <Quote size={23} />
                <blockquote>
                  The goal isn&apos;t to make more documents. It&apos;s to make every
                  property conversation feel better prepared.
                </blockquote>
              </div>
            </div>
            <div className={styles.benefitList}>
              {benefits.map((benefit) => {
                const Icon = benefit.icon;
                return (
                  <article key={benefit.title}>
                    <div><Icon size={20} /></div>
                    <h3>{benefit.title}</h3>
                    <p>{benefit.copy}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className={styles.stepsSection} id="how-it-works">
        <div className={styles.sectionInner}>
          <div className={styles.stepsHeader}>
            <p className={styles.kicker}>FROM LISTING TO LIVE</p>
            <h2>Three steps. One beautifully consistent result.</h2>
          </div>
          <ol className={styles.steps}>
            <li>
              <span>1</span>
              <div className={styles.stepVisual}><ScanLine size={27} /></div>
              <h3>Bring in the listing</h3>
              <p>Paste a listing URL or enter the details yourself. Review the facts and choose the best imagery.</p>
            </li>
            <li>
              <span>2</span>
              <div className={styles.stepVisual}><BarChart3 size={27} /></div>
              <h3>Review the evidence</h3>
              <p>Review STR, lease or sales evidence and comparables, then refine the appraisal with your local knowledge.</p>
            </li>
            <li>
              <span>3</span>
              <div className={styles.stepVisual}><Sparkles size={27} /></div>
              <h3>Publish the pack</h3>
              <p>Choose your approved design, check the preview and share a polished PDF, live page or collateral set.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className={styles.examplesSection} id="examples">
        <div className={styles.sectionInner}>
          <div className={styles.examplesHeading}>
            <p className={styles.kicker}>YOUR BRAND, NOT OURS</p>
            <h2>One platform. A completely different expression for every agency.</h2>
          </div>
          <div className={styles.brandExamples}>
            <article className={styles.brandExampleDark}>
              <div className={styles.brandExampleMeta}><span>01</span><span>EDITORIAL / MINIMAL</span></div>
              <div className={styles.brandExampleDocument}>
                <span>OBSIDIAN</span>
                <div className={styles.brandExamplePhoto}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={PROPERTY_IMAGE} alt="Sample editorial property report" />
                </div>
                <small>PROPERTY APPRAISAL</small>
                <strong>Designed for considered decisions.</strong>
              </div>
            </article>
            <article className={styles.brandExampleBlue}>
              <div className={styles.brandExampleMeta}><span>02</span><span>BOLD / CONTEMPORARY</span></div>
              <div className={styles.brandExampleDocument}>
                <span>HOMESTEAD.</span>
                <small>SHORT-TERM RENTAL POTENTIAL</small>
                <strong>$98,500</strong>
                <i>estimated gross revenue p.a.</i>
                <div className={styles.brandBars}><b /><b /><b /><b /><b /></div>
              </div>
            </article>
            <article className={styles.brandExampleWarm}>
              <div className={styles.brandExampleMeta}><span>03</span><span>WARM / LIFESTYLE</span></div>
              <div className={styles.brandExampleDocument}>
                <span>FIELD &amp; FOLK</span>
                <small>42 OCEAN PARADE</small>
                <strong>Make yourself at home.</strong>
                <div className={styles.brandCircleImage}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={PROPERTY_IMAGE} alt="Sample lifestyle property brochure" />
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.solutionsSection} id="solutions">
        <div className={styles.sectionInner}>
          <div className={styles.solutionsHeading}>
            <p className={styles.kicker}>START THE WAY THAT SUITS YOU</p>
            <h2>Self-serve when you&apos;re ready. Custom when your brand needs more.</h2>
          </div>
          <div className={styles.solutionCards}>
            <article>
              <div className={styles.solutionBadge}>SELF-SERVE</div>
              <h3>Start creating today.</h3>
              <p>Set up your logo, colours and team, then create from our ready-to-use report designs.</p>
              <ul>
                <li><Check size={16} /> Pay per pack or choose a monthly plan</li>
                <li><Check size={16} /> Approved StayPack template library</li>
                <li><Check size={16} /> Upgrade whenever your team grows</li>
              </ul>
              <Link href="/signup">Create an account <ArrowRight size={16} /></Link>
            </article>
            <article className={styles.customSolution}>
              <div className={styles.solutionBadge}>CUSTOM AGENCY ROLLOUT</div>
              <h3>Make StayPack unmistakably yours.</h3>
              <p>We translate your visual identity into a tailored report system, configure your team and guide the launch.</p>
              <ul>
                <li><Check size={16} /> Bespoke report and collateral designs</li>
                <li><Check size={16} /> Done-with-you brand implementation</li>
                <li><Check size={16} /> Proofing, revisions and team handover</li>
              </ul>
              <a href="mailto:hello@staypack.app?subject=Custom%20StayPack%20agency%20rollout">
                Talk about your rollout <ArrowRight size={16} />
              </a>
            </article>
          </div>
        </div>
      </section>

      <section className={styles.pricingSection} id="pricing">
        <div className={styles.sectionInner}>
          <div className={styles.pricingPanel}>
            <div className={styles.pricingCopy}>
              <p className={styles.kicker}>FLEXIBLE FROM THE FIRST LISTING</p>
              <h2>Try the value before you build the habit.</h2>
              <p>
                Start with a single listing pack, move to a monthly plan when
                the volume makes sense, or have us build a custom agency system.
              </p>
              <ArrowLink href="/signup">Create a free branded preview</ArrowLink>
            </div>
            <div className={styles.pricingModes}>
              <div>
                <span>PAY AS YOU GO</span>
                <strong><small>from</small> $99</strong>
                <p>per published listing pack</p>
              </div>
              <div>
                <span>SELF-SERVE</span>
                <strong><small>from</small> $249</strong>
                <p>per month, plus GST</p>
              </div>
              <div>
                <span>CUSTOM</span>
                <strong>Let&apos;s talk</strong>
                <p>brand launch + monthly plan</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.faqSection}>
        <div className={styles.sectionInner}>
          <div className={styles.faqLayout}>
            <div>
              <p className={styles.kicker}>THE SHORT VERSION</p>
              <h2>A few things agencies usually ask.</h2>
            </div>
            <div className={styles.faqs}>
              <details>
                <summary>Does this replace our designer?<span>+</span></summary>
                <p>It removes the need for repetitive production work on each listing. You can use StayPack&apos;s ready-made designs or have us translate your designer&apos;s brand direction into a reusable template system.</p>
              </details>
              <details>
                <summary>Can every agent use the same brand setup?<span>+</span></summary>
                <p>Yes. Your agency controls the approved brand system and templates, while individual agents can use their own profile, contact details and headshot.</p>
              </details>
              <details>
                <summary>Are short-term rental estimates guaranteed?<span>+</span></summary>
                <p>No. StayPack presents estimated gross STR revenue using available market evidence and clearly labels the assumptions and limitations. It is not a valuation or income guarantee.</p>
              </details>
              <details>
                <summary>What happens with a custom rollout?<span>+</span></summary>
                <p>We collect your brand assets, configure and proof your report designs, make the agreed revisions, then activate the workspace once you approve the system.</p>
              </details>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.finalCta}>
        <div className={styles.finalCtaOrb} />
        <div className={styles.sectionInner}>
          <div className={styles.finalCtaContent}>
            <p className={styles.kicker}>YOUR NEXT LISTING, BEAUTIFULLY PACKAGED</p>
            <h2>Put the design bottleneck behind you.</h2>
            <p>Create a branded preview yourself, or talk to us about building a tailored system for your agency.</p>
            <div>
              <Link className={styles.lightButton} href="/signup">Create a report <ArrowRight size={18} /></Link>
              <a className={styles.ghostButton} href="mailto:hello@staypack.app?subject=StayPack%20demo">Book a conversation</a>
            </div>
          </div>
        </div>
      </section>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            <div>
              <StayPackLogo href="/" height={25} />
              <p>Property reports and collateral, beautifully packed in your brand.</p>
            </div>
            <div className={styles.footerLinks}>
              <div>
                <strong>PRODUCT</strong>
                <a href="#product">Overview</a>
                <a href="#examples">Examples</a>
                <a href="#pricing">Pricing</a>
              </div>
              <div>
                <strong>AGENCIES</strong>
                <a href="#solutions">Self-serve</a>
                <a href="#solutions">Custom rollout</a>
                <a href="mailto:hello@staypack.app">Contact</a>
              </div>
              <div>
                <strong>ACCOUNT</strong>
                <Link href="/login">Log in</Link>
                <Link href="/signup">Create account</Link>
              </div>
            </div>
          </div>
          <div className={styles.footerBottom}>
            <span>© {new Date().getFullYear()} StayPack</span>
            <span>Estimated gross STR revenue is indicative only and is not a valuation or income guarantee.</span>
          </div>
        </div>
      </footer>
    </main>
  );
}

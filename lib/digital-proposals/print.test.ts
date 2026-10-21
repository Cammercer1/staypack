// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { formatCurrency } from "@/lib/reports/formatters";
import { monthlyToWeekly } from "@/lib/property-market";
import { defaultAssignment } from "./assignment";
import { BRAND_DEFAULTS } from "./brand";
import { proposalFromAppraisalReport } from "./data";
import { createProposalFixture } from "./fixtures";
import { comparablesByEstimate } from "./presentation";
import { proposalPrintHtml } from "./print";
import { DEFAULT_PROPOSAL_DRAFT } from "./template";
import type { ProposalSnapshot } from "./workspace";

function fixture(): ProposalSnapshot {
  return { version: 1, data: createProposalFixture(), draft: structuredClone(DEFAULT_PROPOSAL_DRAFT), brand: BRAND_DEFAULTS, attachments: [] };
}
const render = (snapshot: ProposalSnapshot) => new DOMParser().parseFromString(proposalPrintHtml(snapshot), "text/html");

describe("proposal print pages", () => {
  it("prints only explicitly selected supporting photos in saved order using frozen URLs", () => {
    const snapshot = fixture();
    const frozen = Array.from({ length: 8 }, (_, index) => `https://assets.example.com/frozen-${index}.jpg`);
    snapshot.data.property.heroImageUrl = frozen[0];
    snapshot.data.property.gallery = frozen;
    const legacy = render(snapshot);
    expect([...legacy.querySelectorAll("h1")].some(heading => heading.textContent === "Property photos")).toBe(false);
    snapshot.draft.propertyImages = { heroImageUrl: "https://source.example.com/cover.jpg", gallery: ["https://source.example.com/cover.jpg", "https://source.example.com/kitchen.jpg"] };
    const document = render(snapshot);
    const photoPages = [...document.querySelectorAll("section.page")].filter(page => page.querySelector("h1")?.textContent?.startsWith("Property photos"));
    expect(photoPages).toHaveLength(2);
    expect(photoPages.map(page => page.querySelectorAll(".comparable img").length)).toEqual([6, 1]);
    expect(photoPages.flatMap(page => [...page.querySelectorAll(".comparable img")].map(img => img.getAttribute("src")))).toEqual(frozen.slice(1));
    expect(photoPages[1].querySelector("h1")?.textContent).toContain("(continued)");
    expect(document.querySelectorAll(`img[src="${frozen[0]}"]`)).toHaveLength(1);
    expect(document.body.innerHTML).not.toContain("source.example.com");
    expect(document.querySelectorAll("footer")).toHaveLength(1);
    snapshot.data.property.gallery = [frozen[0]];
    expect(render(snapshot).querySelectorAll("section.page").length).toBe(legacy.querySelectorAll("section.page").length);
  });
  it("includes the property's locality on the cover using saved, escaped address fields", () => {
    const snapshot = fixture();
    Object.assign(snapshot.data.property, { address: "7/2-4 Dolphin Street", suburb: "Randwick", state: "NSW", postcode: "2031" });
    const cover = render(snapshot).querySelector(".overlay")!;
    expect(cover.querySelector("h1")?.textContent).toBe("7/2-4 Dolphin Street");
    expect(cover.querySelector("p")?.textContent).toBe("Randwick, NSW 2031");
    snapshot.data.property.suburb = "<script>untrusted</script>";
    const escaped = render(snapshot).querySelector(".overlay")!;
    expect(escaped.querySelector("script")).toBeNull();
    expect(escaped.textContent).toContain("<script>untrusted</script>, NSW 2031");
    Object.assign(snapshot.data.property, { suburb: "", state: "", postcode: "" });
    expect(render(snapshot).querySelectorAll(".overlay p")).toHaveLength(2);
  });
  it("explains the property value used for gross yields and omits yields without a positive value", () => {
    const snapshot = fixture();
    expect(render(snapshot).body.textContent).toContain("Based on an estimated property value of $1,250,000. Gross yield is estimated annual gross revenue divided by this value.");
    for (const estimatedValue of [null, 0]) {
      snapshot.data.property.estimatedValue = estimatedValue;
      const text = render(snapshot).body.textContent;
      expect(text).not.toContain("Estimated gross yield:");
      expect(text).not.toContain("Based on an estimated property value");
      expect(text).toContain("Figures are gross estimates before fees and operating costs.");
    }
  });
  it("includes available bedroom and distance context for STR comparables without inventing missing details", () => {
    const snapshot = fixture();
    snapshot.data.comparables = [
      { name: "Nearby apartment", imageUrl: "", bedrooms: 1, annualRevenue: 50000, distanceM: 650 },
      { name: "Coastal apartment", imageUrl: "", bedrooms: 2, annualRevenue: 50000, distanceM: 1250 },
      { name: "Limited evidence", imageUrl: "", bedrooms: null, annualRevenue: null, distanceM: null },
    ];
    const cards = [...render(snapshot).querySelectorAll(".comparable")];
    expect(cards[0].querySelector(".note")?.textContent).toBe("1 bedroom · 650 m away");
    expect(cards[1].querySelector(".note")?.textContent).toBe("2 bedrooms · 1.3 km away");
    expect(cards[2].querySelector(".note")).toBeNull();
    expect(cards[2].textContent).toContain("Not available");
  });
  it("shows initials when an agent photo is missing or fails to load without losing contact details", () => {
    const snapshot = fixture();
    snapshot.data.agents = [
      { name: "Cameron Mercer", role: "Agent", email: "agent@example.com", phone: "0412345678", photoUrl: "https://example.com/expired.jpg" },
      { name: "Taylor Lee", role: "Agent", email: "taylor@example.com", phone: "", photoUrl: "" },
    ];
    const before = structuredClone(snapshot);
    const document = render(snapshot);
    const avatars = [...document.querySelectorAll(".portrait")];
    expect(avatars.map(node => node.textContent)).toEqual(["CM", "TL"]);
    const failed = avatars[0].querySelector("img")!;
    expect(failed.getAttribute("alt")).toBe("");
    new Function(failed.getAttribute("onerror")!).call(failed);
    expect(avatars[0].querySelector("img")).toBeNull();
    expect(avatars[0].textContent).toBe("CM");
    expect(avatars[1].querySelector("img")).toBeNull();
    expect(document.querySelector(".contacts")?.textContent).toContain("agent@example.com");
    expect(document.querySelector('a[aria-label="Call Cameron Mercer"]')?.getAttribute("href")).toBe("tel:0412345678");
    expect(document.querySelector('a[aria-label="Email Cameron Mercer"]')?.getAttribute("href")).toBe("mailto:agent%40example.com");
    expect(snapshot).toEqual(before);
  });
  it("provides public agency contact links when selected agents have no usable contact details", () => {
    const snapshot = fixture();
    Object.assign(snapshot.data.agency, { phone: "02 1234 5678", email: "office@example.com", websiteUrl: "https://example.com/contact?source=proposal&kind=str" });
    snapshot.data.agents = [{ name: "Alex Morgan", role: "Agent", email: "unavailable", phone: "TBC", photoUrl: "" }];
    const document = render(snapshot);
    expect(document.body.textContent).toContain("Contact Coast & Country");
    expect(document.querySelector('a[aria-label="Call Coast & Country"]')?.getAttribute("href")).toBe("tel:0212345678");
    expect(document.querySelector('a[aria-label="Email Coast & Country"]')?.getAttribute("href")).toBe("mailto:office%40example.com");
    expect(document.querySelector('a[aria-label="Visit Coast & Country"]')?.getAttribute("href")).toBe(snapshot.data.agency.websiteUrl);
    expect(document.body.textContent).not.toContain("Contact Coast & Country to discuss");
    snapshot.data.agents[0].email = "alex@example.com";
    expect(render(snapshot).querySelector('a[aria-label="Email Coast & Country"]')).toBeNull();
    expect(render(snapshot).querySelector('a[aria-label="Email Alex Morgan"]')?.getAttribute("href")).toBe("mailto:alex%40example.com");
  });
  it.each(["1 Jul 2026", "2026-07-01T00:00:00+10:00"])("preserves a sold calendar date in the PDF: %s", soldDate => {
    const f = createLintRegressionFixtures();
    const data = proposalFromAppraisalReport(f.sales.final_report_json!, "sales");
    data.appraisal!.comparables = [{ ...data.appraisal!.comparables[0], soldDate, status: "sold" }];
    const document = render({ ...fixture(), data, draft: defaultAssignment(f.agency, "sales").defaults });
    expect(document.body.textContent).toContain("Sold 1 July 2026");
    expect(document.body.textContent).not.toContain("30 June 2026");
  });
  it("repeats the brand and section title on comparable continuation pages", () => {
    const snapshot = fixture();
    snapshot.data.agency.logoUrl = "https://example.com/logo.png";
    snapshot.data.comparables = Array.from({ length: 6 }, (_, index) => ({ name: `Comparable ${index + 1}`, imageUrl: `https://example.com/${index}.jpg`, bedrooms: 2, annualRevenue: 50000 + index * 1000, distanceM: index * 100 }));
    snapshot.draft.pages = snapshot.draft.pages.filter(page => page.kind === "hero" || page.kind === "evidence");
    snapshot.draft.pages[1].body = "Evidence for {{property.address}}";
    const document = render(snapshot);
    const pages = [...document.querySelectorAll("section.page")];
    expect(pages).toHaveLength(3);
    expect(pages[1].querySelectorAll(".comparable")).toHaveLength(4);
    expect(pages[2].querySelectorAll(".comparable")).toHaveLength(2);
    for (const page of pages.slice(1)) {
      expect(page.querySelector("header .logo")?.getAttribute("src")).toBe(snapshot.data.agency.logoUrl);
      expect(page.querySelector("h1")?.textContent).toContain("Comparable listings");
    }
    expect(pages[2].querySelector("h1")?.textContent).toContain("(continued)");
    expect([...document.querySelectorAll(".comparable h3")].map(node => node.textContent)).toEqual(comparablesByEstimate(snapshot.data).map(comp => comp.name));
    expect(document.querySelectorAll(".body")).toHaveLength(1);
    expect(pages[2].querySelector(".body")?.textContent).toBe(`Evidence for ${snapshot.data.property.address}`);
    expect(document.querySelectorAll("footer")).toHaveLength(1);
    expect(pages[2].querySelector("footer")?.textContent).toBe(snapshot.data.disclaimer);
  });
  it.each([
    [1, 1, 1, "1 bedroom · 1 bathroom · 1 car space"],
    [0, 1.5, 2, "0 bedrooms · 1.5 bathrooms · 2 car spaces"],
    [null, 2, null, "2 bathrooms"],
  ])("prints property counts with the right grammar (%s/%s/%s)", (bedrooms, bathrooms, carSpaces, expected) => {
    const snapshot = fixture();
    Object.assign(snapshot.data.property, { bedrooms, bathrooms, carSpaces });
    expect(render(snapshot).querySelector(".overlay p:last-child")?.textContent).toBe(expected);
  });
  it.each(["lease", "sales"] as const)("prints the %s appraisal values and evidence without STR labels", kind => {
    const f = createLintRegressionFixtures();
    const data = proposalFromAppraisalReport(f[kind].final_report_json!, kind);
    const draft = defaultAssignment(f.agency, kind).defaults;
    const document = render({ ...fixture(), data, draft });
    expect(document.body.textContent).not.toContain("Short-term rental proposal");
    expect(document.body.textContent).not.toContain("Estimated gross STR revenue");
    expect(document.body.textContent).toContain(kind === "lease" ? "Estimated weekly rental range" : "Estimated selling range");
    expect(document.querySelectorAll(".comparable")).toHaveLength(data.appraisal!.comparables.length);
    expect(document.body.textContent).toContain(data.appraisal!.comparables[0].name);
  });
  it("converts US weekly storage values to monthly rental figures and preserves undisclosed sold prices", () => {
    const f = createLintRegressionFixtures();
    const data = proposalFromAppraisalReport(f.lease.final_report_json!, "lease");
    data.market = { country: "US", currency: "USD", rentPeriod: "month" };
    Object.assign(data.appraisal!, { minimum: monthlyToWeekly(3000), maximum: monthlyToWeekly(3600), midpoint: monthlyToWeekly(3300) });
    data.appraisal!.comparables[0].price = monthlyToWeekly(3500);
    const lease = render({ ...fixture(), data, draft: defaultAssignment(f.agency, "lease").defaults });
    expect(lease.body.textContent).toContain("Estimated monthly rental range");
    expect(lease.body.textContent).toContain(`${formatCurrency(3000, "USD")} – ${formatCurrency(3600, "USD")} per month`);
    expect(lease.body.textContent).toContain(`${formatCurrency(3500, "USD")} / month`);
    const salesData = proposalFromAppraisalReport(f.sales.final_report_json!, "sales");
    Object.assign(salesData.appraisal!.comparables[0], { price: null, priceDisplay: "Price withheld", soldDate: "2026-04-03", status: "sold" });
    const sales = render({ ...fixture(), data: salesData, draft: defaultAssignment(f.agency, "sales").defaults });
    expect(sales.body.textContent).toContain("Price withheld");
    expect(sales.body.textContent).toContain("Sold 3 Apr 2026");
  });
});

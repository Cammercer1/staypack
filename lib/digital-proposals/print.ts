import { formatCurrency, formatDistanceMeters } from "@/lib/reports/formatters";
import { formatEvidenceDate as dateLabel } from "@/lib/appraisals/formatEvidenceDate";
import { rentForPeriod } from "@/lib/property-market";
import { comparablesByEstimate, comparisonRows } from "./data";
import { monthlyRevenueProjection } from "./seasonality";
import { occupancyMonthLabel } from "./occupancy";
import { resolveTokenText } from "./tokens";
import { proposalPrintFontUrl } from "./fonts";
import { agencyContactActions, contactActions, hasAgentContact, type ProposalContactAction } from "./contacts";
import type { ProposalSnapshot } from "./workspace";
const escape = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

const image = (url: string, alt: string, className = "") => /^https:\/\//i.test(url) ? `<img class="${className}" src="${escape(url)}" alt="${escape(alt)}">` : "";
const portrait = (url: string, name: string) => {
  const initials = name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "?";
  return `<div class="portrait" aria-label="${escape(name)}"><span>${escape(initials)}</span>${/^https:\/\//i.test(url) ? `<img src="${escape(url)}" alt="" onerror="this.remove()">` : ""}</div>`;
};
const fact = (value: number | null, label: string) => value === null ? "" : `${value} ${label}${value === 1 ? "" : "s"}`;
const contactLinks = (actions: ProposalContactAction[]) => actions.map(action => `<p><a href="${escape(action.href)}" aria-label="${escape(action.label)}">${escape(action.value)}</a></p>`).join("");
/** Trusted, versioned print renderer. Uses the exact published data and token values. */
export function proposalPrintHtml(snapshot: ProposalSnapshot) {
  const { data, draft, brand } = snapshot;
  const fontUrl = proposalPrintFontUrl(brand);
  const text = (value: string) => escape(resolveTokenText(value, data).text);
  const rows = comparisonRows(data, "annual");
  const months = monthlyRevenueProjection(data);
  const money = (value: number | null) => value === null ? "Not available" : formatCurrency(value, data.market?.currency);
  const appraisal = data.appraisal;
  const lease = appraisal?.kind === "lease";
  const period = data.market?.rentPeriod ?? "week";
  const appraisalMoney = (value: number | null, rental = lease) => money(value === null ? null : rental ? rentForPeriod(value, data.market) : value);
  const reportLabel = appraisal ? lease ? "Rental appraisal" : "Sales appraisal" : "Short-term rental proposal";
  const printPage = (content: string) => `<section class="page"><header>${image(data.agency.logoUrl, data.agency.name, "logo") || escape(data.agency.name)}<span>${reportLabel}</span></header>${content}</section>`;
  const annual = `<div class="figures">${rows.map(row => `<div><span>${escape(row.label)}</span><strong>${money(row.value)}</strong><small>Estimated annual gross revenue</small></div>`).join("")}</div>`;
  const monthly = months ? `<h3>Monthly revenue estimates</h3><table><thead><tr><th>Month</th>${rows.map(row => `<th>${escape(row.label)}</th>`).join("")}</tr></thead><tbody>${months.map(month => `<tr><td>${month.month}</td><td>${money(month.ltr)}</td><td>${money(month.market)}</td><td>${money(month.managed)}</td></tr>`).join("")}</tbody></table>` : "";
  const occupancy = data.occupancy ? `<h3>Historical market occupancy</h3><table><thead><tr><th>Month</th><th>Occupancy</th></tr></thead><tbody>${data.occupancy.months.map(row => `<tr><td>${occupancyMonthLabel(row.month)}</td><td>${row.average === null ? "Not available" : Math.round(row.average) + "%"}</td></tr>`).join("")}</tbody></table><p class="note">Historical market averages${data.occupancy.label ? ` for ${escape(data.occupancy.label)}` : ""}; not a forecast for this property.${data.occupancy.allPropertyTypes ? " Includes all property types with the same bedroom count." : ""}</p>` : `<p class="note">${escape(data.occupancyNotice ?? "Monthly occupancy history is not available for this market.")}</p>`;
  const yields = comparisonRows(data, "yield");
  const locality = [data.property.suburb.trim(), [data.property.state.trim(), data.property.postcode.trim()].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  // Read the frozen presentation URLs, never the editable draft's source URLs.
  const propertyPhotos = draft.propertyImages ? [...new Set(data.property.gallery)].filter(url => url && url !== data.property.heroImageUrl) : [];
  const pages = draft.pages.filter(page => page.enabled).flatMap(page => {
    let content = `<h1>${text(page.title)}</h1>`;
    if (page.kind === "hero") content = `<div class="hero">${image(data.property.heroImageUrl, data.property.address)}<div class="overlay"><h1>${text(draft.content.title)}</h1>${locality ? `<p>${escape(locality)}</p>` : ""}<p>${text(draft.content.introduction)} ${text(draft.content.recipientLine)}</p><p>${[fact(data.property.bedrooms, "bedroom"), fact(data.property.bathrooms, "bathroom"), fact(data.property.carSpaces, "car space")].filter(Boolean).join(" · ")}</p></div></div>`;
    if (page.kind === "comparison") content = `<h1>${text(draft.content.comparisonTitle)}</h1>${annual}${data.property.estimatedValue ? `<p class="note">Estimated gross yield: ${yields.map(row => `${escape(row.label)} ${row.value === null ? "—" : row.value.toFixed(1) + "%"}`).join(" · ")}</p><p class="note">Based on an estimated property value of ${money(data.property.estimatedValue)}. Gross yield is estimated annual gross revenue divided by this value.</p>` : ""}${draft.pages.some(item => item.kind === "forecast") ? "" : monthly}<p class="note">Figures are gross estimates before fees and operating costs.</p>`;
    if (page.kind === "forecast") content += `<div class="forecast"><div>${monthly || `<p class="note">Monthly revenue estimates are not available for this appraisal.</p>`}</div><div>${occupancy}</div></div><p class="note">Estimated gross revenue is before fees and operating costs. Both STR scenarios follow the saved seasonal revenue pattern; long-term rent is spread evenly. Rounded monthly figures add up to the annual estimates.</p>`;
    if (page.kind === "comparison" && appraisal) {
      const range = appraisal.minimum !== null && appraisal.maximum !== null ? `${appraisalMoney(appraisal.minimum)} – ${appraisalMoney(appraisal.maximum)}` : appraisalMoney(appraisal.midpoint);
      content = `<h1>${text(draft.content.comparisonTitle)}</h1><div class="figures"><div><span>${lease ? `Estimated ${period === "month" ? "monthly" : "weekly"} rental range` : "Estimated selling range"}</span><strong>${range}${lease ? ` per ${period}` : ""}</strong></div></div><p class="note">${lease ? "An estimate of gross rent before management fees and property costs. Achievable rent depends on property condition and market demand." : "An appraisal estimate based on the reviewed comparable evidence. The eventual selling price will depend on buyer demand, presentation and the sales process."}</p>${appraisal.summary ? `<p class="body">${escape(appraisal.summary)}</p>` : ""}${appraisal.highlights.length ? `<ul>${appraisal.highlights.map(item => `<li>${escape(item)}</li>`).join("")}</ul>` : ""}${appraisal.methodology ? `<p class="note body">${escape(appraisal.methodology)}</p>` : ""}`;
    }
    if (page.kind === "evidence") {
      const cards = appraisal ? appraisal.comparables.map(comp => `<div class="comparable">${image(comp.imageUrl, comp.name)}<h3>${escape(comp.name)}</h3><small>${comp.status === "sold" ? "Sold" : comp.status === "for_sale" ? "For sale · asking price" : "Rental listing"}</small><p>${[fact(comp.bedrooms, "bedroom"), fact(comp.bathrooms, "bathroom")].filter(Boolean).join(" · ")}</p><p>${comp.price !== null ? appraisalMoney(comp.price, comp.status === "rental") : escape(comp.priceDisplay || "Price not disclosed")}${comp.status === "rental" && comp.price !== null ? ` / ${period}` : ""}</p>${comp.status === "sold" && comp.soldDate ? `<small>Sold ${escape(dateLabel(comp.soldDate))}</small>` : ""}</div>`) : comparablesByEstimate(data).map(comp => {
        const distance = formatDistanceMeters(comp.distanceM);
        const context = [fact(comp.bedrooms, "bedroom"), distance ? `${distance} away` : ""].filter(Boolean).join(" · ");
        return `<div class="comparable">${image(comp.imageUrl, comp.name)}<h3>${escape(comp.name)}</h3>${context ? `<p class="note">${escape(context)}</p>` : ""}<p>${money(comp.annualRevenue)} / year</p><small>Estimated gross STR revenue</small></div>`;
      });
      // Explicit batches keep each continuation branded instead of relying on an unheaded browser page break.
      const batches = Array.from({ length: Math.max(1, Math.ceil(cards.length / 4)) }, (_, index) => cards.slice(index * 4, index * 4 + 4));
      return batches.map((batch, index) => printPage(`<h1>${text(page.title)}${index ? ' <span class="continuation">(continued)</span>' : ""}</h1>${index === 0 && appraisal?.evidenceNote ? `<p class="note">${escape(appraisal.evidenceNote)}</p>` : ""}<div class="comparables">${batch.join("")}</div>${index === batches.length - 1 && page.body ? `<p class="body">${text(page.body)}</p>` : ""}`));
    }
    if (page.kind === "service" && page.service) {
      const service = page.service;
      content = `<p class="note">${text(service.eyebrow)}</p><h1 class="body">${text(service.headline)}</h1><p>${text(service.introduction)}</p>${image(service.imageUrl, resolveTokenText(service.imageAlt, data).text, "service-image")}<p class="note">${text(service.imageCaption)}</p><div class="service-highlights">${service.highlights.map(item => `<div><h3>${text(item.title)}</h3><p>${text(item.body)}</p></div>`).join("")}</div>${service.proof ? `<div class="service-proof"><strong>${text(service.proof.value)} ${text(service.proof.label)}</strong><p>${text(service.proof.body)}</p></div>` : ""}`;
    }
    if (page.body) content += `<p class="body">${text(page.body)}</p>`;
    if (page.kind === "next_steps") {
      const agentContactAvailable = hasAgentContact(data.agents);
      const agencyContacts = agentContactAvailable ? [] : agencyContactActions(data.agency);
      content += data.agents?.length ? `<h3>${data.agents.length === 1 ? "Your contact" : "Your contacts"}</h3><div class="contacts">${data.agents.map(agent => `<div class="contact">${portrait(agent.photoUrl, agent.name)}<div><strong>${escape(agent.name)}</strong>${agent.role ? `<p>${escape(agent.role)}</p>` : ""}${contactLinks(contactActions(agent))}</div></div>`).join("")}</div>` : "";
      if (agencyContacts.length) content += `<h3>Contact ${escape(data.agency.name)}</h3>${contactLinks(agencyContacts)}`;
      content += snapshot.attachments.length ? `<h3>Documents</h3><ul>${snapshot.attachments.map(item => `<li>${escape(item.name)}</li>`).join("")}</ul><p class="note">Open your digital proposal to download these documents.</p>` : "";
      content += draft.links.map(link => `<p><a href="${escape(link.url)}">${escape(link.label)}</a></p>`).join("");
      if (!page.body && !draft.links.length && !snapshot.attachments.length && !agentContactAvailable && !agencyContacts.length) content += `<p>Contact ${escape(data.agency.name)} to discuss the next steps for your property.</p>`;
    }
    if (page.kind === "hero" && propertyPhotos.length) {
      const batches = Array.from({ length: Math.ceil(propertyPhotos.length / 6) }, (_, index) => propertyPhotos.slice(index * 6, index * 6 + 6));
      return [printPage(content), ...batches.map((batch, index) => printPage(`<h1>Property photos${index ? ' <span class="continuation">(continued)</span>' : ""}</h1><p class="note">${escape(data.property.address)}${locality ? `, ${escape(locality)}` : ""}</p><div class="comparables">${batch.map((url, offset) => `<div class="comparable">${image(url, `${data.property.address} - property photo ${index * 6 + offset + 1}`)}</div>`).join("")}</div>`))];
    }
    return printPage(content);
  });
  // Final-page disclaimer is always included, even when the account hides Next steps.
  pages[pages.length - 1] = pages[pages.length - 1].replace("</section>", `<footer>${escape(data.disclaimer)}</footer></section>`);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(data.property.address)}</title>${fontUrl ? `<link rel="stylesheet" href="${escape(fontUrl)}">` : ""}<style>
@page{size:A4;margin:16mm}*{box-sizing:border-box}body{margin:0;background:${brand.background};color:${brand.text};font:11pt ${brand.bodyFont}}h1,h2,h3{font-family:${brand.headingFont};line-height:1.15}h1{font-size:29pt;margin:12mm 0 9mm}h3{font-size:14pt}p{line-height:1.65}.page{display:flow-root;break-after:page;min-height:250mm}.page:last-child{break-after:auto}header{position:relative;z-index:1;break-inside:avoid;min-height:10mm;display:flex;align-items:center;justify-content:space-between;padding-bottom:6mm;border-bottom:1px solid ${brand.muted}40;font-size:10pt}.logo{width:auto;max-width:45mm;height:12mm;object-fit:contain}header span{font-size:9pt}.hero{position:relative;margin-top:7mm;height:216mm;background:#123438;overflow:hidden}.hero>img{width:100%;height:100%;object-fit:cover}.overlay{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;text-align:center;padding:14mm;color:white;background:linear-gradient(transparent,#000d)}.overlay h1{color:white}.figures{display:flex;gap:5mm}.figures>div{flex:1;background:${brand.surface};padding:5mm}.figures span,.figures small{display:block;font-size:9pt}.figures strong{display:block;font:24pt ${brand.headingFont};margin:4mm 0}.note,small{font-size:9pt;color:${brand.muted}}table{width:100%;border-collapse:collapse;font-size:9pt}th,td{text-align:right;padding:2.3mm;border-bottom:1px solid ${brand.muted}30}th:first-child,td:first-child{text-align:left}.forecast{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:7mm}.forecast table{font-size:8pt}.forecast th,.forecast td{padding:2mm 1mm}.comparables{display:grid;grid-template-columns:1fr 1fr;gap:7mm}.comparable{break-inside:avoid}.comparable img{width:100%;height:43mm;object-fit:cover}.comparable h3{margin:3mm 0;font-size:12pt}.comparable p{margin:2mm 0}.contacts{display:flex;gap:8mm;margin-bottom:9mm}.contact{display:flex;align-items:flex-start;gap:4mm;flex:1;min-width:0;break-inside:avoid;overflow-wrap:anywhere}.contact p{font-size:10pt;margin:1mm 0}.portrait{width:16mm;height:16mm;object-fit:cover;border-radius:50%}.body{white-space:pre-wrap;overflow-wrap:anywhere}footer{margin-top:14mm;padding-top:6mm;border-top:1px solid ${brand.muted}40;font-size:9pt;line-height:1.6;color:${brand.muted}}a{color:${brand.primary}}img{max-width:100%}
.continuation{font-size:13pt;color:${brand.muted};white-space:nowrap}.service-image{width:100%;height:55mm;object-fit:cover}.service-highlights{display:grid;grid-template-columns:1fr 1fr;gap:4mm 8mm}.service-highlights>div{break-inside:avoid}.service-highlights h3{margin:3mm 0}.service-highlights p,.service-proof p{font-size:10pt;margin:2mm 0}.service-proof{margin-top:7mm;border-top:1px solid ${brand.muted}30;padding-top:5mm}
.portrait{position:relative;display:grid;place-items:center;flex-shrink:0;overflow:hidden;background:${brand.surface};color:${brand.text};font-weight:600}.portrait img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
</style></head><body>${pages.join("")}</body></html>`;
}

import type { PageOneMarketingCopy } from "./pageOneMarketingCopy";
import { appraisalSubjectFeatures } from "./appraisalSubjectFeatures";

/** Validate newly generated marketing text, not saved publications or user-edited copy. */
export function appraisalMarketingCopyIssues(copy: PageOneMarketingCopy, kind: "lease" | "sales", sourceDescription = ""): string[] {
  const fields = [copy.heading, ...copy.bullets, ...Object.values(copy.blurb_variants)];
  const issues: string[] = [];
  // Accented English words/names, punctuation and currency remain valid.
  if (fields.some(value => [...value.matchAll(/\p{Letter}/gu)].some(match => !/\p{Script=Latin}/u.test(match[0])))) {
    issues.push("Write all marketing text in English; remove unexpected non-Latin words or characters.");
  }
  if (kind === "lease" && fields.some(value => /\b(?:rent(?:al|s)?|yield|returns?|income|cashflow|leasing|letting)\b/i.test(value) &&
    /\b(?:upper|lower|above|below|premium|strong|demand|expectations?|market|range|guide|estimat\w*|return|yield|income|cashflow|competitive|achiev\w*|support\w*|align\w*)\b/i.test(value))) {
    issues.push("Describe the property only. Do not claim a rent level, rental demand, yield, return or position relative to the market; the reviewed evidence section explains the rental guide.");
  }
  if (!appraisalSubjectFeatures(sourceDescription, 0, 0).includes("elevated position") && fields.some(value => /\b(?:elevated (?:position|setting)|(?:top|upper)[ -]floor|upper level|high[ -]floor)\b/i.test(value))) {
    issues.push("The source does not establish an elevated position. Remove upper-floor or elevation claims; high ceilings, flooring and a building's size do not establish the apartment's floor.");
  }
  return issues;
}

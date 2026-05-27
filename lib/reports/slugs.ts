import slugify from "slugify";

export function slugifyAgencyName(name: string) {
  return slugify(name, {
    lower: true,
    strict: true,
    trim: true,
  });
}

export function generateReportSlug() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

export function buildPublicReportUrl(
  reportsBaseUrl: string,
  agencySlug: string,
  reportSlug: string,
) {
  const base = reportsBaseUrl.replace(/\/$/, "");
  return `${base}/${agencySlug}/${reportSlug}`;
}

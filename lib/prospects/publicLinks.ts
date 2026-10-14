import slugify from "slugify";

const publicSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isProspectPublicSlug(value: string) {
  return value.length <= 300 && publicSlugPattern.test(value);
}

/** Allocate once when publishing; changes to a brand or address must not rename a link. */
export function prospectSlugCandidates(company: string, address: string, suburb: string, id: string) {
  const segment = (value: string, max: number) => slugify(value, { lower: true, strict: true })
    .slice(0, max).replace(/-+$/, "");
  const companySlug = segment(company, 100);
  const propertySlug = segment(`${address.replace(/\//g, "-")} ${suburb}`, 140);
  if (!companySlug || !propertySlug || !/^[a-f0-9-]{36}$/.test(id)) throw new Error("A company, property address and proposal ID are required for the public link.");
  const base = `${companySlug}/${propertySlug}`;
  return [base, `${base}-${id.slice(0, 8)}`, `${base}-${id}`];
}

export function prospectPublicPath(proposal: { public_slug?: string | null; public_token?: string | null }) {
  if (proposal.public_slug && isProspectPublicSlug(proposal.public_slug)) return `/examples/${proposal.public_slug}`;
  if (proposal.public_token && /^[a-f0-9]{64}$/.test(proposal.public_token)) return `/example/${proposal.public_token}`;
  return null;
}

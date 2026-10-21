// Only presentation image fields. Never rewrite listing links, action links,
// attachments, fonts, captions or customer content that happens to contain a URL.
const imageFields = new Set([
  "heroImageUrl", "gallery", "imageUrl", "logoUrl", "photoUrl",
  "hero_image_url", "selected_image_urls", "thumbnail_url", "photo_url",
  "logo_url", "logo_light_url", "logo_dark_url",
]);

export function proposalImageUrls(snapshot: unknown): string[] {
  const urls = new Set<string>();
  function visit(value: unknown, field = "") {
    if (typeof value === "string" && value && imageFields.has(field)) urls.add(value);
    else if (Array.isArray(value)) value.forEach(item => visit(item, field));
    else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => visit(item, key));
  }
  visit(snapshot);
  return [...urls];
}

/** Clone only after every image has a verified replacement; leave the input untouched. */
export function replaceProposalImages<T>(snapshot: T, replacements: ReadonlyMap<string, string>): T {
  for (const url of proposalImageUrls(snapshot)) {
    if (!replacements.get(url)) throw new Error("A proposal image has not been preserved");
  }
  function visit(value: unknown, field = ""): unknown {
    if (typeof value === "string" && value && imageFields.has(field)) return replacements.get(value)!;
    if (Array.isArray(value)) return value.map(item => visit(item, field));
    if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item, key)]));
    return value;
  }
  return visit(snapshot) as T;
}

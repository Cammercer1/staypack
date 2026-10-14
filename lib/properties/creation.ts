export const creationOptions = [
  { id: "str", label: "Short-term rental appraisal", description: "Estimated STR revenue and a digital proposal.", path: "/short-term-rentals/appraisals/new", group: "Appraisals" },
  { id: "lease", label: "Rental appraisal", description: "Rental evidence and a proposal for your landlord.", path: "/appraisals/new?kind=lease", group: "Appraisals" },
  { id: "sales", label: "Sales appraisal", description: "Sales evidence and a proposal for your vendor.", path: "/appraisals/new?kind=sales", group: "Appraisals" },
  { id: "brochure", label: "Brochure", description: "Property marketing for buyers or tenants.", path: "/brochures/new", group: "Marketing" },
  { id: "social", label: "Social media post", description: "Branded images in square, wide and story formats.", path: "/social/new", group: "Marketing" },
] as const;

export function creationPath(path: string, listingId?: string) {
  if (!listingId) return path;
  return `${path}${path.includes("?") ? "&" : "?"}listing_id=${encodeURIComponent(listingId)}`;
}

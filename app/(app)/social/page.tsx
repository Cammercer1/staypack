import Link from "next/link";
import { Images, Plus } from "lucide-react";
import { requireAgency } from "@/lib/auth/requireUser";
import { ListingThumbnail } from "@/components/listings/ListingThumbnail";
import { listSocialPosts, socialQuerySchema, SOCIAL_PAGE_SIZE } from "@/lib/social/workspace";

export default async function SocialLibraryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, agency } = await requireAgency();
  const parsed = socialQuerySchema.safeParse(await searchParams);
  if (!parsed.success) return <div className="space-y-4"><h1 className="font-display text-3xl">Social media</h1><p>These search filters are invalid.</p><Link href="/social">Reset filters</Link></div>;
  const filters = parsed.data;
  const result = await listSocialPosts(supabase, agency.id, filters);
  const filtered = Boolean(filters.q || filters.page > 1);
  const href = (page: number) => `/social?${new URLSearchParams({ q: filters.q, page: String(page) })}`;
  return <div data-theme="staypack-workspace" className="space-y-7 text-base-content">
    <header className="flex flex-wrap items-start justify-between gap-5"><div><h1 className="font-display text-3xl sm:text-4xl">Social media</h1><p className="mt-3 text-base-content/65">Create branded property images, ready to download and post.</p></div><Link href="/social/new" className="du-btn du-btn-sm du-btn-primary min-h-12"><Plus className="size-4" aria-hidden="true" />Create social post</Link></header>
    <form action="/social" className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 basis-60 text-sm">Property address<input type="search" name="q" defaultValue={filters.q} maxLength={160} placeholder="Search social posts" className="du-input du-input-sm mt-2 min-h-12 w-full" /></label><button className="du-btn du-btn-sm min-h-12">Search</button>{filtered && <Link href="/social" className="du-btn du-btn-sm du-btn-ghost min-h-12">Clear filters</Link>}</form>
    {result.rows.length ? <ul className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">{result.rows.map((row, index) => <li key={row.id}>
      <Link href={`/social/${row.id}`} className="block overflow-hidden rounded-xl border border-base-300 bg-base-100 transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-primary">
        <ListingThumbnail eager={index === 0} src={row.exports?.square?.png_url || row.exports?.wide?.png_url || row.exports?.story?.png_url || row.listing.hero_image_url} address={row.listing.property_address || "Property"} className="aspect-square h-auto w-full rounded-none" />
        <div className="space-y-3 p-5"><h2 className="break-words font-display text-xl">{row.listing.property_address || "Untitled property"}</h2><p className="text-sm text-base-content/65">Square · Wide · Story</p><div className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="du-badge du-badge-sm">{row.status === "draft" ? "Draft" : "Ready to download"}</span><span>{new Date(row.updated_at).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "Australia/Sydney" })}</span></div></div>
      </Link>
    </li>)}</ul> : <section className="rounded-xl border border-dashed border-base-300 p-8"><Images className="mb-4 size-6 text-base-content/50" aria-hidden="true" /><h2 className="font-display text-2xl">{filtered ? "No matching social posts" : "Create your first social post"}</h2><p className="mt-3 text-sm text-base-content/65">{filtered ? "Try another address or clear the filters." : "Choose a property and turn its photos into branded social images."}</p></section>}
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><p>{result.total} saved design{result.total === 1 ? "" : "s"}</p><div className="flex gap-3">{filters.page > 1 && <Link className="du-btn du-btn-sm min-h-11" href={href(filters.page - 1)}>Previous</Link>}{filters.page * SOCIAL_PAGE_SIZE < result.total && <Link className="du-btn du-btn-sm min-h-11" href={href(filters.page + 1)}>Next</Link>}</div></div>
  </div>;
}

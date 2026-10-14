import Link from "next/link";
import { requireProspectOperator } from "@/lib/prospects/server";
import { prospectProfileSchema } from "@/lib/prospects/profile";
import { prospectPublicPath } from "@/lib/prospects/publicLinks";

export const dynamic = "force-dynamic";
export const metadata = { title: "Prospect brands", robots: { index: false, follow: false } };

export default async function ProspectsPage() {
  const { supabase, user } = await requireProspectOperator();
  const [brands, proposals] = await Promise.all([
    supabase.from("prospect_brands").select("id,name,profile_json,converted_agency_id").eq("owner_user_id", user.id).order("name"),
    supabase.from("prospect_proposals").select("id,brand_id,property_address,public_slug,public_token,published_at,revoked_at,created_at").eq("owner_user_id", user.id).order("created_at", { ascending: false }),
  ]);
  if (brands.error || proposals.error) throw new Error("Unable to load prospect brands.");
  return <div className="space-y-8">
    <header><p className="text-sm text-muted-foreground">Internal sales</p><h1 className="mt-2 font-display text-3xl">Prospect brands</h1>
      <p className="mt-3 max-w-2xl text-muted-foreground">Standalone branding and example proposals. Customer accounts cannot access this library. Branding is attached to an account only after signup.</p></header>
    {!brands.data.length && <p>No prospect brands saved yet.</p>}
    {brands.data.map(row => {
      const profile = prospectProfileSchema.parse(row.profile_json);
      const examples = proposals.data.filter(item => item.brand_id === row.id);
      return <section key={row.id} className="rounded-xl border border-base-300 bg-base-100 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-display text-2xl">{row.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{row.converted_agency_id ? "Attached after signup" : "Prospect · no customer account"} · {profile.upliftPercent}% management uplift</p></div>
          {profile.brand.website_url && <a href={profile.brand.website_url} target="_blank" rel="noreferrer" className="du-btn du-btn-sm du-btn-outline">Agency website</a>}</div>
        <ul className="mt-5 divide-y divide-base-300">{examples.map(example => <li key={example.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <span>{example.property_address}</span>{example.published_at && !example.revoked_at && prospectPublicPath(example) ? <Link className="du-btn du-btn-sm du-btn-primary" href={prospectPublicPath(example)!}>Open example</Link> : <span className="text-sm text-muted-foreground">{example.revoked_at ? "Link revoked" : "Draft"}</span>}
        </li>)}</ul>
      </section>;
    })}
  </div>;
}

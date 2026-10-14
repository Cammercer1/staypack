import Link from "next/link";
import { requireAgency } from "@/lib/auth/requireUser";
import { brochureQuerySchema, listBrochures } from "@/lib/brochures/workspace";
import { BrochureLibrary } from "@/components/brochures/BrochureLibrary";
export default async function BrochuresPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase, agency } = await requireAgency();
  const parsed = brochureQuerySchema.safeParse(await searchParams);
  if (!parsed.success) return <div className="space-y-4"><h1 className="font-display text-3xl">Brochures</h1><p>These brochure filters are invalid.</p><Link href="/brochures">Reset filters</Link></div>;
  const result = await listBrochures(supabase, agency.id, parsed.data).catch(() => null);
  if (!result) return <div className="space-y-4"><h1 className="font-display text-3xl">Brochures</h1><p role="alert">Your brochures could not be loaded. Please refresh to try again.</p></div>;
  return <BrochureLibrary {...result} filters={parsed.data} />;
}

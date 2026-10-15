import { requireAgency } from "@/lib/auth/requireUser";
import { getSiteUrl } from "@/lib/env";
import { calculatorBrand } from "@/lib/str-calculator/brand";
import type { CalculatorLead, CalculatorSettings } from "@/lib/str-calculator/schema";
import { StrCalculatorWorkspace } from "@/components/str-calculator/StrCalculatorWorkspace";

export const dynamic = "force-dynamic";
export const metadata = { title: "STR calculator" };

export default async function StrCalculatorPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { supabase, agency, role } = await requireAgency();
  const query = await searchParams;
  const page = Math.min(10000, Math.max(1, Math.floor(Number(query.page) || 1)));
  const [settings, leads] = await Promise.all([
    supabase.from("str_calculator_widgets").select("id,public_token,enabled,country,ask_phone").eq("agency_id", agency.id).maybeSingle(),
    supabase.from("str_calculator_leads").select("id,address,bedrooms,email,phone,country,status,estimate_json,created_at,report_id", { count: "exact" })
      .eq("agency_id", agency.id).order("created_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * 25, page * 25 - 1),
  ]);
  if (settings.error || leads.error) throw new Error("Couldn’t load the STR calculator. Please try again.");
  // Match the local environment during development; published embeds use the canonical origin.
  const baseUrl = process.env.NODE_ENV === "development" ? "http://localhost:3000" : getSiteUrl();
  // This uncached server request stamps the snapshot once; the client receives a stable value.
  // eslint-disable-next-line react-hooks/purity
  const loadedAt = Date.now();
  return <StrCalculatorWorkspace brand={calculatorBrand(agency)} initialWidget={settings.data as CalculatorSettings | null} canManage={["owner", "admin"].includes(role)} leads={(leads.data ?? []) as CalculatorLead[]} total={leads.count ?? 0} page={page} baseUrl={baseUrl} loadedAt={loadedAt} />;
}

import { notFound, redirect } from "next/navigation";
import { requireAgency } from "@/lib/auth/requireUser";

export default async function LegacyReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, agency } = await requireAgency();

  const { data: report } = await supabase
    .from("reports")
    .select("listing_id")
    .eq("id", id)
    .eq("agency_id", agency.id)
    .maybeSingle();

  if (!report?.listing_id) {
    notFound();
  }

  redirect(`/listings/${report.listing_id}/reports/${id}`);
}

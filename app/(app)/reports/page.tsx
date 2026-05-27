import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAgency } from "@/lib/auth/requireUser";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Button } from "@/components/ui/button";
import { ReportLibrary } from "@/components/reports/ReportLibrary";
import type { Report } from "@/lib/types";

export default async function ReportsPage() {
  const { supabase, agency } = await requireAgency();

  const { data: reports } = await supabase
    .from("reports")
    .select("*")
    .eq("agency_id", agency.id)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Reports"
        highlight="Your"
        title="STR report library."
        description="Browse draft, generated and published reports. Copy links, download PDFs, and continue editing from one library."
        action={
          <Link href="/reports/new" prefetch={false}>
            <Button size="lg">
              <Plus className="h-4 w-4" />
              Create report
            </Button>
          </Link>
        }
      />
      <ReportLibrary reports={(reports ?? []) as Report[]} />
    </div>
  );
}

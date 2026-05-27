import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAgency } from "@/lib/auth/requireUser";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/reports/formatters";
import type { Report } from "@/lib/types";

export default async function DashboardPage() {
  const { supabase, agency } = await requireAgency();

  const { data: reports } = await supabase
    .from("reports")
    .select("*")
    .eq("agency_id", agency.id)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(5);

  const allReports = (reports ?? []) as Report[];
  const counts = allReports.reduce(
    (acc, report) => {
      acc[report.status] = (acc[report.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Dashboard"
        highlight="Welcome"
        title={`back, ${agency.name}.`}
        description="Create branded STR potential reports, review estimates, and publish buyer-facing pages from one place."
        action={
          <Link href="/reports/new" prefetch={false}>
            <Button size="lg">
              <Plus className="h-4 w-4" />
              Create report
            </Button>
          </Link>
        }
      />

      <div className="grid gap-4 md:grid-cols-4">
        {["draft", "generated", "published", "failed"].map((status) => (
          <div key={status} className="surface-card p-6">
            <p className="text-sm font-medium capitalize text-muted-foreground">
              {status}
            </p>
            <p className="mt-3 font-display text-4xl tracking-tight">
              {counts[status] ?? 0}
            </p>
          </div>
        ))}
      </div>

      <div className="surface-card p-6 md:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl tracking-tight">Recent reports</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your latest STR potential reports in one place.
            </p>
          </div>
          <Link href="/reports">
            <Button variant="outline">View all</Button>
          </Link>
        </div>

        <div className="space-y-4">
          {allReports.length === 0 ? (
            <div className="surface-soft px-6 py-10 text-center">
              <p className="font-display text-xl tracking-tight">No reports yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Create your first STR potential report to get started.
              </p>
            </div>
          ) : (
            allReports.map((report) => (
              <div
                key={report.id}
                className="flex flex-col gap-4 border-b border-border/60 pb-4 last:border-none last:pb-0 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {report.property_address ?? "Untitled report"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {report.suburb ?? "No suburb"} ·{" "}
                    {formatCurrency(report.final_estimate_json?.annualRevenue)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="rounded-full px-3 py-1">
                    {report.status}
                  </Badge>
                  <Link href={`/reports/${report.id}`}>
                    <Button variant="outline">Open</Button>
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

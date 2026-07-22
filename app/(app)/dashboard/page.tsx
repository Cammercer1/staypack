import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAgency } from "@/lib/auth/requireUser";
import { PageHeader } from "@/components/app-shell/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardAnalytics } from "@/components/dashboard/DashboardAnalytics";
import { formatCurrency } from "@/lib/reports/formatters";
import type { Listing, Report } from "@/lib/types";

export default async function DashboardPage() {
  const { supabase, agency } = await requireAgency();

  const [{ data: listings }, { count: activeListings }] = await Promise.all([
    supabase
      .from("listings")
      .select("*, reports(*)")
      .eq("agency_id", agency.id)
      .neq("status", "archived")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("agency_id", agency.id)
      .neq("status", "archived"),
  ]);

  const recentListings = (listings ?? []).map((row) => {
    const reports = (row.reports ?? []) as Report[];
    const { reports: _reports, ...listing } = row;
    return {
      ...(listing as Listing),
      str_report:
        reports.find((report) => report.status !== "archived") ?? reports[0] ?? null,
    };
  });

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Dashboard"
        highlight="Welcome"
        title={`back, ${agency.name}.`}
        description="Create properties, prepare appraisals and publish polished marketing material from one place."
        action={
          <Link href="/listings/new" prefetch={false}>
            <Button size="lg">
              <Plus className="h-4 w-4" />
              New listing
            </Button>
          </Link>
        }
      />

      <DashboardAnalytics activeListings={activeListings ?? 0} />

      <div className="surface-card p-6 md:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl tracking-tight">Recent listings</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Your latest open house listings in one place.
            </p>
          </div>
          <Link href="/listings">
            <Button variant="outline">View all</Button>
          </Link>
        </div>

        <div className="space-y-4">
          {recentListings.length === 0 ? (
            <div className="surface-soft px-6 py-10 text-center">
              <p className="font-display text-xl tracking-tight">No listings yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Create your first listing to get started.
              </p>
            </div>
          ) : (
            recentListings.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-4 border-b border-border/60 pb-4 last:border-none last:pb-0 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium">
                    {item.property_address ?? "Untitled listing"}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {item.suburb ?? "No suburb"} ·{" "}
                    {formatCurrency(item.str_report?.final_estimate_json?.annualRevenue)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {item.str_report ? (
                    <Badge variant="secondary" className="rounded-full px-3 py-1">
                      {item.str_report.status}
                    </Badge>
                  ) : null}
                  <Link href={`/listings/${item.id}`}>
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

"use client";

import Link from "next/link";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/reports/StatusBadge";
import { CopyLinkButton } from "@/components/reports/CopyLinkButton";
import { DeleteReportButton } from "@/components/reports/DeleteReportButton";
import { DownloadPdfButton } from "@/components/reports/DownloadPdfButton";
import { formatCurrency } from "@/lib/reports/formatters";
import type { Report } from "@/lib/types";

const cellClassName = "px-4 py-5 whitespace-normal";
const headClassName = "h-auto px-4 py-4";

export function ReportLibrary({ reports }: { reports: Report[] }) {
  return (
    <div className="surface-card overflow-hidden p-6 md:p-8">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={headClassName}>Property</TableHead>
            <TableHead className={headClassName}>Status</TableHead>
            <TableHead className={headClassName}>
              Estimated annual STR revenue
            </TableHead>
            <TableHead className={headClassName}>Created</TableHead>
            <TableHead className={headClassName}>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reports.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={5}
                className="px-4 py-10 text-center text-muted-foreground"
              >
                No reports yet.
              </TableCell>
            </TableRow>
          ) : (
            reports.map((report) => (
              <TableRow key={report.id}>
                <TableCell className={cellClassName}>
                  <div>
                    <p className="font-medium">
                      {report.property_address ?? "Untitled report"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {[report.suburb, report.state].filter(Boolean).join(", ")}
                    </p>
                  </div>
                </TableCell>
                <TableCell className={cellClassName}>
                  <StatusBadge status={report.status} />
                </TableCell>
                <TableCell className={cellClassName}>
                  {formatCurrency(report.final_estimate_json?.annualRevenue)}
                </TableCell>
                <TableCell className={cellClassName}>
                  {format(new Date(report.created_at), "dd MMM yyyy")}
                </TableCell>
                <TableCell className={cellClassName}>
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/reports/${report.id}`}>
                      <Button variant="outline" size="sm">
                        Open
                      </Button>
                    </Link>
                    <CopyLinkButton url={report.public_url} />
                    <DownloadPdfButton
                      url={report.pdf_url}
                      reportId={report.id}
                      cacheVersion={report.updated_at}
                      canGenerate={
                        report.status === "published" && Boolean(report.public_slug)
                      }
                    />
                    <DeleteReportButton
                      reportId={report.id}
                      propertyAddress={report.property_address}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

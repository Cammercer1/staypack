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
import { DeleteListingButton } from "@/components/listings/DeleteListingButton";
import { formatCurrency } from "@/lib/reports/formatters";
import type { ListingWithReport } from "@/lib/types";

const cellClassName = "px-4 py-5 whitespace-normal";
const headClassName = "h-auto px-4 py-4";

export function ListingLibrary({ listings }: { listings: ListingWithReport[] }) {
  return (
    <div className="surface-card overflow-hidden p-6 md:p-8">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={headClassName}>Property</TableHead>
            <TableHead className={headClassName}>STR report</TableHead>
            <TableHead className={headClassName}>
              Estimated annual STR revenue
            </TableHead>
            <TableHead className={headClassName}>Created</TableHead>
            <TableHead className={headClassName}>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {listings.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={5}
                className="px-4 py-10 text-center text-muted-foreground"
              >
                No listings yet.
              </TableCell>
            </TableRow>
          ) : (
            listings.map((listing) => {
              const report = listing.str_report;

              return (
                <TableRow key={listing.id}>
                  <TableCell className={cellClassName}>
                    <div>
                      <p className="font-medium">
                        {listing.property_address ?? "Untitled listing"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {[listing.suburb, listing.state].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className={cellClassName}>
                    {report ? (
                      <StatusBadge status={report.status} />
                    ) : (
                      <span className="text-sm text-muted-foreground">No report</span>
                    )}
                  </TableCell>
                  <TableCell className={cellClassName}>
                    {formatCurrency(report?.final_estimate_json?.annualRevenue)}
                  </TableCell>
                  <TableCell className={cellClassName}>
                    {format(new Date(listing.created_at), "dd MMM yyyy")}
                  </TableCell>
                  <TableCell className={cellClassName}>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/listings/${listing.id}`}>
                        <Button variant="outline" size="sm">
                          Open
                        </Button>
                      </Link>
                      <DeleteListingButton
                        listingId={listing.id}
                        propertyAddress={listing.property_address}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

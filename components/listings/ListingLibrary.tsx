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
import { Badge } from "@/components/ui/badge";
import { DeleteListingButton } from "@/components/listings/DeleteListingButton";
import { initialListingAgents } from "@/lib/reports/listingAgents";
import type { ListingLibraryRow, ListingPurpose } from "@/lib/types";

const cellClassName = "px-4 py-5 whitespace-normal";
const headClassName = "h-auto px-4 py-4";

const PURPOSE_LABELS: Record<ListingPurpose, string> = {
  sale: "Sale",
  lease: "Lease",
};

function listingAgentsLabel(listing: ListingLibraryRow) {
  const names = initialListingAgents(listing.scraped_listing_json?.agents)
    .map((agent) => agent.name.trim())
    .filter(Boolean);

  if (!names.length) {
    return null;
  }

  return names.join(", ");
}

export function ListingLibrary({ listings }: { listings: ListingLibraryRow[] }) {
  return (
    <div className="surface-card overflow-hidden p-6 md:p-8">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={headClassName}>Property</TableHead>
            <TableHead className={headClassName}>Type</TableHead>
            <TableHead className={headClassName}>Agents</TableHead>
            <TableHead className={headClassName}>Total leads</TableHead>
            <TableHead className={headClassName}>Created</TableHead>
            <TableHead className={headClassName}>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {listings.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={6}
                className="px-4 py-10 text-center text-muted-foreground"
              >
                No listings yet.
              </TableCell>
            </TableRow>
          ) : (
            listings.map((listing) => {
              const purpose = listing.listing_purpose ?? "sale";
              const agentsLabel = listingAgentsLabel(listing);

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
                    <Badge variant="outline">{PURPOSE_LABELS[purpose]}</Badge>
                  </TableCell>
                  <TableCell className={cellClassName}>
                    {agentsLabel ? (
                      <span className="text-sm">{agentsLabel}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className={cellClassName}>
                    <span className="tabular-nums">{listing.total_leads.toLocaleString()}</span>
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

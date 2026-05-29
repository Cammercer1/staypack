"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Link2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AsyncLoadingOverlay } from "@/components/ui/async-loading-overlay";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UnknownAgentsAfterScrapeModal } from "@/components/reports/UnknownAgentsAfterScrapeModal";
import { isPersistedListing } from "@/lib/listings/emptyListingDraft";
import type { Listing, ParsedListing } from "@/lib/types";

type UnknownAgent = ParsedListing["agents"][number] & { name: string };
type UnknownAgentsCompletion = {
  saved: Array<{
    originalName: string;
    agent: UnknownAgent;
  }>;
  skippedNames: string[];
};

type Props = {
  listing: Listing;
  onComplete: (listing: Listing) => void;
  onManualEntry: (listing: Listing) => void;
};

export function ListingUrlStep({ listing, onComplete, onManualEntry }: Props) {
  const [listingUrl, setListingUrl] = useState(listing.listing_url ?? "");
  const [loading, setLoading] = useState(false);
  const [pendingListing, setPendingListing] = useState<Listing | null>(null);
  const [unknownAgents, setUnknownAgents] = useState<UnknownAgent[]>([]);
  const [agentModalOpen, setAgentModalOpen] = useState(false);

  function openManualEntry() {
    onManualEntry({
      ...listing,
      listing_url: listingUrl || null,
    });
  }

  function finishScrape(importedListing: Listing) {
    setPendingListing(null);
    setUnknownAgents([]);
    setAgentModalOpen(false);
    onComplete(importedListing);
  }

  function handleUnknownAgentsComplete(result: UnknownAgentsCompletion) {
    if (pendingListing) {
      const skipped = new Set(result.skippedNames);
      const savedByOriginalName = new Map(
        result.saved.map((entry) => [entry.originalName, entry.agent]),
      );
      const currentAgents = pendingListing.scraped_listing_json?.agents ?? [];
      const nextAgents = currentAgents
        .filter((agent) => !skipped.has(agent.name ?? ""))
        .map((agent) => {
          const replacement = savedByOriginalName.get(agent.name ?? "");
          return replacement ?? agent;
        });

      finishScrape({
        ...pendingListing,
        scraped_listing_json: pendingListing.scraped_listing_json
          ? {
              ...pendingListing.scraped_listing_json,
              agents: nextAgents,
            }
          : pendingListing.scraped_listing_json,
      });
    }
  }

  async function handleScrape() {
    setLoading(true);

    try {
      const response = await fetch("/api/listings/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isPersistedListing(listing) ? { listing_id: listing.id } : {}),
          listing_url: listingUrl,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error ?? "Import failed");
        toast.message("Enter the listing details manually on the next step.", {
          description: "You can type the property info and upload up to 5 photos.",
        });
        openManualEntry();
        return;
      }

      if (payload.warnings?.length) {
        toast.message("Listing imported — review the prefilled fields and choose images", {
          description: payload.warnings.slice(0, 2).join(" "),
        });
      } else {
        toast.success("Listing imported — review details on the next step");
      }

      const importedListing = payload.listing as Listing;
      const unknown = (payload.unknown_agents ?? []) as UnknownAgent[];

      if (unknown.length > 0) {
        setPendingListing(importedListing);
        setUnknownAgents(unknown);
        setAgentModalOpen(true);
        return;
      }

      finishScrape(importedListing);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
      toast.message("Enter the listing details manually on the next step.", {
        description: "You can type the property info and upload up to 5 photos.",
      });
      openManualEntry();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <AsyncLoadingOverlay
        active={loading}
        title="Importing listing"
        description="Fetching the page, extracting property details, and writing your listing description. This usually takes 20–40 seconds."
        className="max-w-2xl"
      >
      <div className="space-y-5 rounded-2xl border border-border/70 bg-background/70 p-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Link2 className="h-4 w-4" />
            Paste a listing URL
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            We fetch the listing page and extract property details automatically.
            On the next step you&apos;ll review the data, choose photos, and assign
            listing agents before saving.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="listing_url">Listing URL</Label>
          <Input
            id="listing_url"
            value={listingUrl}
            onChange={(event) => setListingUrl(event.target.value)}
            placeholder="https://www.exampleagency.com.au/listing/..."
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={handleScrape} disabled={!listingUrl || loading}>
            {loading ? (
              <>
                <Loader2 className="animate-spin" />
                Importing listing...
              </>
            ) : (
              "Import listing"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => openManualEntry()}
            disabled={loading}
          >
            Enter details manually
          </Button>
        </div>
      </div>
      </AsyncLoadingOverlay>

      <UnknownAgentsAfterScrapeModal
        open={agentModalOpen}
        agents={unknownAgents}
        onComplete={handleUnknownAgentsComplete}
      />
    </>
  );
}

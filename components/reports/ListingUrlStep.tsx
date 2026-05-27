"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UnknownAgentsAfterScrapeModal } from "@/components/reports/UnknownAgentsAfterScrapeModal";
import { isPersistedReport } from "@/lib/reports/emptyReportDraft";
import type { ParsedListing, Report } from "@/lib/types";

type UnknownAgent = ParsedListing["agents"][number] & { name: string };

type Props = {
  report: Report;
  onComplete: (report: Report) => void;
  onManualEntry: (report: Report) => void;
};

export function ListingUrlStep({ report, onComplete, onManualEntry }: Props) {
  const [listingUrl, setListingUrl] = useState(report.listing_url ?? "");
  const [loading, setLoading] = useState(false);
  const [pendingReport, setPendingReport] = useState<Report | null>(null);
  const [unknownAgents, setUnknownAgents] = useState<UnknownAgent[]>([]);
  const [agentModalOpen, setAgentModalOpen] = useState(false);

  function openManualEntry() {
    onManualEntry({
      ...report,
      listing_url: listingUrl || null,
      status: "scraped",
    });
  }

  function finishScrape(nextReport: Report) {
    setPendingReport(null);
    setUnknownAgents([]);
    setAgentModalOpen(false);
    onComplete(nextReport);
  }

  function handleUnknownAgentsComplete() {
    if (pendingReport) {
      finishScrape(pendingReport);
    }
  }

  async function handleScrape() {
    setLoading(true);

    try {
      const response = await fetch("/api/listings/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isPersistedReport(report) ? { report_id: report.id } : {}),
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
        toast.success("Listing imported — choose up to 5 images on the next step");
      }

      const unknown = (payload.unknown_agents ?? []) as UnknownAgent[];
      if (unknown.length > 0) {
        setPendingReport(payload.report as Report);
        setUnknownAgents(unknown);
        setAgentModalOpen(true);
        return;
      }

      finishScrape(payload.report as Report);
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
      <div className="max-w-2xl space-y-5 rounded-2xl border border-border/70 bg-background/70 p-6">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium">
            <Link2 className="h-4 w-4" />
            Paste a listing URL
          </div>
          <p className="text-sm leading-6 text-muted-foreground">
            We fetch the listing page, extract property details automatically, then
            you choose up to 5 photos on the next step. If import fails, you&apos;ll
            enter everything manually instead.
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
            {loading ? "Importing listing..." : "Import listing"}
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

      <UnknownAgentsAfterScrapeModal
        open={agentModalOpen}
        agents={unknownAgents}
        onComplete={handleUnknownAgentsComplete}
      />
    </>
  );
}

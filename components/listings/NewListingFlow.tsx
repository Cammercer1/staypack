"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ListingUrlStep } from "@/components/reports/ListingUrlStep";
import { ScrapedListingReviewStep } from "@/components/reports/ScrapedListingReviewStep";
import { createEmptyListingDraft } from "@/lib/listings/emptyListingDraft";
import type { Listing } from "@/lib/types";

type Step = "import" | "review";

export function NewListingFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("import");
  const [listing, setListing] = useState<Listing>(() => createEmptyListingDraft());
  const [manualMode, setManualMode] = useState(false);

  if (step === "review") {
    return (
      <ScrapedListingReviewStep
        listing={listing}
        manualMode={manualMode}
        listingSetup
        onSaved={({ listing: savedListing }) => {
          router.push(`/listings/${savedListing.id}`);
          router.refresh();
        }}
      />
    );
  }

  return (
    <ListingUrlStep
      listing={listing}
      onComplete={(importedListing) => {
        setListing(importedListing);
        setManualMode(false);
        setStep("review");
      }}
      onManualEntry={(draftListing) => {
        setListing(draftListing);
        setManualMode(true);
        setStep("review");
      }}
    />
  );
}

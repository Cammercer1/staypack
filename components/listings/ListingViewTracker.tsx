"use client";

import { useEffect, useRef } from "react";

export function ListingViewTracker({ listingId }: { listingId: string }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("via") === "qr") {
      return;
    }

    fired.current = true;

    fetch("/api/public/track-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listing_id: listingId,
        referrer: document.referrer || null,
        source: "direct",
      }),
    }).catch(() => {
      // ignore — tracking failures must never affect the user
    });
  }, [listingId]);

  return null;
}

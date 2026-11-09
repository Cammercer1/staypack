"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { LoadingBrand } from "@/lib/digital-proposals/loadingBrand";
import { ProposalLoading } from "./ProposalLoading";

/** Retain the same branded shell while the viewer hydrates and its cover image decodes. */
export function ProposalReveal({ brand, coverImage, children }: { brand: LoadingBrand; coverImage?: string; children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    const reveal = () => { if (active) setReady(true); };
    if (!coverImage) { reveal(); return; }
    const image = new window.Image();
    image.src = coverImage;
    void image.decode().catch(() => {}).then(reveal);
    // A failed or very slow asset must never trap the visitor behind the loading screen.
    const timer = window.setTimeout(reveal, 4000);
    return () => { active = false; window.clearTimeout(timer); };
  }, [coverImage]);
  return <>{!ready && <ProposalLoading brand={brand} />}<div data-proposal-content hidden={!ready}>{children}</div>
    <noscript><style>{'[data-testid="proposal-loading"]{display:none}[data-proposal-content][hidden]{display:block}'}</style></noscript></>;
}

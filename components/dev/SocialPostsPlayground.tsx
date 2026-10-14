"use client";

import { useEffect, useRef, useState } from "react";
import { SocialPostsEditor } from "@/components/collateral/social/SocialPostsEditor";
import { createLintRegressionFixtures } from "@/components/dev/lintRegressionFixtures";
import { buildSocialPostsDocument } from "@/lib/collateral/buildSocialPostsDocument";
import { ensureSocialPostsDocument } from "@/lib/collateral/social/normalizeSocialDocument";
import type { SocialPostsDocumentJson } from "@/lib/collateral/templates/types";
import type { CollateralItem } from "@/lib/types";

/** Synthetic preview. All app API requests are intercepted for this session. */
export function SocialPostsPlayground() {
  const [fixtures] = useState(() => createLintRegressionFixtures());
  const [collateral, setCollateral] = useState<CollateralItem | null>(null);
  const restoreFetch = useRef<(() => void) | null>(null);
  useEffect(() => () => restoreFetch.current?.(), []);

  function startPreview() {
    const { agency, listing, agent } = fixtures;
    let item: CollateralItem = {
      ...fixtures.collateral,
      id: "mock-social",
      type: "social_posts",
      template_id: null,
    };
    const originalDocument = buildSocialPostsDocument({
      agency,
      listing,
      agentProfile: agent,
      collateral: item,
    });
    item = { ...item, document_json: originalDocument };
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
        window.location.origin,
      );
      if (!url.pathname.startsWith("/api/")) return originalFetch(input, init);
      if (url.pathname === "/api/agents")
        return Response.json({ agents: [agent] });
      if (
        url.pathname === "/api/collateral/mock-social" &&
        init?.method === "PATCH"
      ) {
        const patch = JSON.parse(String(init.body));
        const current = item.document_json as SocialPostsDocumentJson;
        item = {
          ...item,
          document_json: ensureSocialPostsDocument({
            ...current,
            ...patch,
            listing: { ...current.listing, ...patch.listing },
          }),
        };
        return Response.json({ collateral: item });
      }
      if (url.pathname === "/api/collateral/mock-social/generate") {
        item = { ...item, document_json: structuredClone(originalDocument) };
        return Response.json({ collateral: item });
      }
      if (url.pathname === "/api/collateral/mock-social/export-png")
        return Response.json({ collateral: item });
      return Response.json(
        { error: "This sample preview does not call live APIs." },
        { status: 400 },
      );
    };
    restoreFetch.current = () => {
      window.fetch = originalFetch;
    };
    setCollateral(item);
  }

  return (
    <main
      data-theme="staypack-workspace"
      className="min-h-dvh bg-base-100 px-4 py-5 text-base-content sm:px-8 sm:py-8"
    >
      <div className="mx-auto max-w-7xl">
        <p className="mb-5 border-b border-base-300 pb-3 text-xs text-base-content/60">
          Sample property · Preview only · Saves stay in this browser session
        </p>
        {collateral ? (
          <SocialPostsEditor
            listing={fixtures.listing}
            agency={fixtures.agency}
            collateral={collateral}
          />
        ) : (
          <button
            type="button"
            className="du-btn du-btn-primary"
            onClick={startPreview}
          >
            Open sample editor
          </button>
        )}
      </div>
    </main>
  );
}

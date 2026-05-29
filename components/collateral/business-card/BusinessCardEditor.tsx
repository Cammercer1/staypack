"use client";

import { useState } from "react";
import { Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { BusinessCardPreviewStage } from "@/components/collateral/business-card/BusinessCardPreviewStage";
import { BusinessCardLayerPanel } from "@/components/collateral/business-card/BusinessCardLayerPanel";
import { CollateralPdfButton } from "@/components/collateral/CollateralPdfButton";
import { Button } from "@/components/ui/button";
import { ensureBusinessCardDocument } from "@/lib/collateral/business-card/normalizeBusinessCardDocument";
import type { BusinessCardVariantId } from "@/lib/collateral/business-card/formats";
import type { BusinessCardDocumentJson } from "@/lib/collateral/templates/types";
import type { AgentProfile, CollateralItem, Listing } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  initialCards: CollateralItem[];
  agents: AgentProfile[];
  listings: Listing[];
};

function getCardLabel(card: CollateralItem) {
  const doc = card.document_json
    ? ensureBusinessCardDocument(card.document_json as BusinessCardDocumentJson)
    : null;
  return doc?.agent.name || "Untitled card";
}

export function BusinessCardEditor({ initialCards, agents, listings }: Props) {
  const [cards, setCards] = useState(initialCards);
  const [selectedCardId, setSelectedCardId] = useState(initialCards[0]?.id ?? "");
  const [document, setDocument] = useState<BusinessCardDocumentJson | null>(() =>
    initialCards[0]?.document_json
      ? ensureBusinessCardDocument(
          initialCards[0].document_json as BusinessCardDocumentJson,
        )
      : null,
  );
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  const selectedCard = cards.find((c) => c.id === selectedCardId) ?? null;
  const activeVariantId = document?.active_variant_id ?? "front";

  function updateSelectedCard(card: CollateralItem) {
    setCards((current) => current.map((e) => (e.id === card.id ? card : e)));
    if (card.document_json) {
      setDocument(
        ensureBusinessCardDocument(card.document_json as BusinessCardDocumentJson),
      );
    }
  }

  function selectCard(card: CollateralItem) {
    setSelectedCardId(card.id);
    setDocument(
      card.document_json
        ? ensureBusinessCardDocument(card.document_json as BusinessCardDocumentJson)
        : null,
    );
  }

  async function createCard() {
    setCreating(true);
    try {
      const response = await fetch("/api/business-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_profile_id: agents[0]?.id ?? null }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to create card");
      const card = payload.collateral as CollateralItem;
      setCards((current) => [card, ...current]);
      selectCard(card);
      toast.success("Business card created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to create card");
    } finally {
      setCreating(false);
    }
  }

  async function saveDocument(nextDocument = document) {
    if (!selectedCard || !nextDocument) return;

    const savedDocument = selectedCard.document_json
      ? ensureBusinessCardDocument(
          selectedCard.document_json as BusinessCardDocumentJson,
        )
      : null;
    const qrChanged =
      nextDocument.qr_listing_id !== (savedDocument?.qr_listing_id ?? null);

    setSaving(true);
    try {
      const response = await fetch(`/api/collateral/${selectedCard.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          active_variant_id: nextDocument.active_variant_id,
          agent_profile_id: nextDocument.agent_profile_id ?? null,
          agent: nextDocument.agent,
          variants: nextDocument.variants,
          ...(qrChanged ? { qr_listing_id: nextDocument.qr_listing_id ?? null } : {}),
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to save card");
      updateSelectedCard(payload.collateral as CollateralItem);
      toast.success("Saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save card");
    } finally {
      setSaving(false);
    }
  }

  function handleVariantChange(variantId: BusinessCardVariantId) {
    setDocument((current) =>
      current ? { ...current, active_variant_id: variantId } : current,
    );
  }

  return (
    <div className="grid min-h-[720px] gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      {/* Cards list */}
      <aside className="surface-card flex flex-col gap-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Cards</h2>
            <p className="text-sm text-muted-foreground">
              Reusable agent cards for your agency.
            </p>
          </div>
          <Button size="sm" onClick={createCard} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            New
          </Button>
        </div>

        <div className="space-y-1.5">
          {cards.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => selectCard(card)}
              className={cn(
                "w-full rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                selectedCardId === card.id
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border/70 bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="block truncate font-medium">{getCardLabel(card)}</span>
              <span className="block truncate text-xs opacity-70">
                {card.pdf_url ? "PDF ready" : "Draft"}
              </span>
            </button>
          ))}
          {cards.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              Create your first card.
            </div>
          ) : null}
        </div>
      </aside>

      {document && selectedCard ? (
        /* Editor: preview (left) + layer panel (right) */
        <div className="grid min-h-0 overflow-hidden rounded-3xl border border-border bg-background shadow-sm lg:grid-cols-[minmax(0,1fr)_320px]">
          <BusinessCardPreviewStage
            document={document}
            activeVariantId={activeVariantId}
            onVariantChange={handleVariantChange}
          />

          <aside className="flex min-h-0 flex-col border-l border-border/70">
            {/* Toolbar */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
              <p className="text-sm font-medium text-muted-foreground">
                {activeVariantId === "front" ? "Front side" : "Back side"}
              </p>
              <div className="flex items-center gap-2">
                <CollateralPdfButton
                  collateralId={selectedCard.id}
                  url={selectedCard.pdf_url}
                  canGenerate
                  cacheVersion={selectedCard.updated_at}
                  onUpdated={updateSelectedCard}
                />
                <Button size="sm" onClick={() => saveDocument()} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save
                </Button>
              </div>
            </div>

            {/* Layer panel */}
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              <BusinessCardLayerPanel
                document={document}
                agents={agents}
                listings={listings}
                onChange={setDocument}
              />
            </div>
          </aside>
        </div>
      ) : (
        <div className="surface-card flex min-h-[520px] items-center justify-center p-8 text-center">
          <div className="max-w-sm">
            <h2 className="font-display text-2xl font-semibold">
              Create an agent business card
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Start with your default agent profile, then customise the front and
              back before exporting a print-ready PDF.
            </p>
            <Button className="mt-5" onClick={createCard} disabled={creating}>
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Create card
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

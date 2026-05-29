"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { LANDING_TEMPLATES, type LandingTemplateId } from "@/lib/listings/templates/registry";

type Props = {
  listingId: string;
  agencySlug: string;
  listingSlug: string;
  /** Template currently being previewed (from URL param or saved value). */
  activeTemplateId: LandingTemplateId;
  /** The template actually saved to the listing in the DB. */
  savedTemplateId: LandingTemplateId;
};

export function LandingTemplatePreviewBar({
  listingId,
  agencySlug,
  listingSlug,
  activeTemplateId,
  savedTemplateId,
}: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  function switchTemplate(id: LandingTemplateId) {
    router.push(`/${agencySlug}/l/${listingSlug}?preview=1&template=${id}`);
  }

  async function saveTemplate() {
    setSaving(true);
    try {
      const res = await fetch(`/api/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ landing_template: activeTemplateId }),
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error ?? "Could not save template");
      toast.success("Template saved");
      // Drop the preview params so the page reloads cleanly with the saved template
      router.push(`/${agencySlug}/l/${listingSlug}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save template");
    } finally {
      setSaving(false);
    }
  }

  const isAlreadySaved = activeTemplateId === savedTemplateId;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-black/10 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
        <p className="shrink-0 text-xs font-semibold uppercase tracking-wider text-black/40">
          Template
        </p>

        {/* Template picker pills */}
        <div className="flex flex-1 flex-wrap gap-2">
          {LANDING_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => switchTemplate(t.id as LandingTemplateId)}
              className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors"
              style={
                activeTemplateId === t.id
                  ? { background: "#000", color: "#fff", borderColor: "#000" }
                  : { background: "transparent", color: "#000", borderColor: "rgba(0,0,0,0.2)" }
              }
            >
              {activeTemplateId === t.id && <Check className="h-3 w-3" />}
              {t.label}
              {savedTemplateId === t.id && activeTemplateId !== t.id && (
                <span className="ml-0.5 text-[10px] opacity-50">(saved)</span>
              )}
            </button>
          ))}
        </div>

        {/* Save CTA */}
        <button
          onClick={saveTemplate}
          disabled={saving || isAlreadySaved}
          className="shrink-0 rounded-md px-4 py-1.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40 hover:opacity-90"
          style={{ background: "#000" }}
        >
          {saving ? (
            <span className="flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </span>
          ) : isAlreadySaved ? (
            "Already saved"
          ) : (
            "Use this template"
          )}
        </button>

        {/* Dismiss */}
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 rounded-full p-1 text-black/30 hover:text-black/60"
          aria-label="Close preview bar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

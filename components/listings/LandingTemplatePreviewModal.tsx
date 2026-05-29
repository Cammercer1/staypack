"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LayoutTemplate, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  LANDING_TEMPLATES,
  resolveLandingTemplate,
  type LandingTemplateId,
} from "@/lib/listings/templates/registry";

// Render the preview at a real phone resolution, then scale it to fit the modal.
const DEVICE_W = 390;
const DEVICE_H = 844;
const SCALE = 0.74;

type Props = {
  listingId: string;
  agencySlug: string;
  listingSlug: string;
  savedTemplate: string | null;
};

export function LandingTemplatePreviewModal({
  listingId,
  agencySlug,
  listingSlug,
  savedTemplate,
}: Props) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  // The template currently saved to the listing. Seeded from the prop, kept in
  // sync when the prop refreshes, and updated immediately on a successful save.
  const [savedTemplateId, setSavedTemplateId] = useState<LandingTemplateId>(
    resolveLandingTemplate(savedTemplate),
  );
  const [activeTemplateId, setActiveTemplateId] =
    useState<LandingTemplateId>(savedTemplateId);
  const [saving, setSaving] = useState(false);
  const [iframeLoading, setIframeLoading] = useState(true);

  // Pick up server-refreshed values (e.g. after router.refresh()).
  useEffect(() => {
    setSavedTemplateId(resolveLandingTemplate(savedTemplate));
  }, [savedTemplate]);

  // Each time the modal opens, start from whatever is actually saved.
  useEffect(() => {
    if (open) {
      setActiveTemplateId(savedTemplateId);
      setIframeLoading(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const previewSrc = `/${agencySlug}/l/${listingSlug}?preview=1&embed=1&template=${activeTemplateId}`;

  function selectTemplate(id: LandingTemplateId) {
    if (id === activeTemplateId) return;
    setIframeLoading(true);
    setActiveTemplateId(id);
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
      // Reflect the new saved template right away so reopening is accurate
      // even if the server refresh hasn't propagated yet.
      setSavedTemplateId(activeTemplateId);
      setOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save template");
    } finally {
      setSaving(false);
    }
  }

  const isAlreadySaved = activeTemplateId === savedTemplateId;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <LayoutTemplate className="h-4 w-4" />
        Preview templates
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
          showCloseButton
        >
          <DialogHeader className="border-b p-4">
            <DialogTitle>Landing page template</DialogTitle>
            <DialogDescription>
              Preview how this listing looks in each template, then save your choice.
            </DialogDescription>
          </DialogHeader>

          {/* Template pills */}
          <div className="flex flex-wrap gap-2 border-b p-4">
            {LANDING_TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTemplate(t.id as LandingTemplateId)}
                className="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors"
                style={
                  activeTemplateId === t.id
                    ? { background: "var(--color-foreground)", color: "var(--color-background)", borderColor: "var(--color-foreground)" }
                    : { borderColor: "var(--color-border)" }
                }
              >
                {activeTemplateId === t.id && <Check className="h-3 w-3" />}
                {t.label}
                {savedTemplateId === t.id && (
                  <span className="ml-0.5 text-[10px] opacity-60">saved</span>
                )}
              </button>
            ))}
          </div>

            {/* Phone-frame preview — iframe renders at a real phone resolution
              (390×844) then scales down so the listing's 100vh layout has room
              to breathe and nothing overlaps. */}
          <div className="flex flex-1 justify-center overflow-y-auto bg-muted/40 p-5">
            <div
              className="relative shrink-0 overflow-hidden rounded-[2.2rem] border-[6px] border-neutral-900 bg-neutral-900 shadow-xl"
              style={{ width: DEVICE_W * SCALE, height: DEVICE_H * SCALE }}
            >
              {iframeLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              )}
              <iframe
                key={activeTemplateId}
                src={previewSrc}
                title={`${activeTemplateId} template preview`}
                onLoad={() => setIframeLoading(false)}
                className="bg-white"
                style={{
                  width: DEVICE_W,
                  height: DEVICE_H,
                  transform: `scale(${SCALE})`,
                  transformOrigin: "top left",
                  border: 0,
                }}
              />
            </div>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-end gap-2 border-t bg-muted/50 p-4">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveTemplate} disabled={saving || isAlreadySaved}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isAlreadySaved ? (
                "Current template"
              ) : (
                "Use this template"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

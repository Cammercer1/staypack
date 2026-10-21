"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Check, ImageIcon, Loader2, Star, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { UnsavedListingGuard } from "@/components/listings/UnsavedListingGuard";
import type { ProposalPhotoSelection } from "@/lib/digital-proposals/photos";
import { MAX_LANDING_IMAGES } from "@/lib/listings/collateralImageLimits";
import { cn } from "@/lib/utils";

const MAX_PHOTOS = MAX_LANDING_IMAGES;
const uniquePhotos = (photos: string[]) => [...new Set(photos.map(photo => photo.trim()).filter(Boolean))];

function initialSelection(value: ProposalPhotoSelection, availablePhotos: string[]): ProposalPhotoSelection {
  const gallery = uniquePhotos(value.gallery);
  const heroImageUrl = value.heroImageUrl.trim() || gallery[0] || uniquePhotos(availablePhotos)[0] || "";
  if (heroImageUrl && !gallery.includes(heroImageUrl)) gallery.unshift(heroImageUrl);
  const limited = gallery.slice(0, MAX_PHOTOS);
  if (heroImageUrl && !limited.includes(heroImageUrl)) limited[MAX_PHOTOS - 1] = heroImageUrl;
  return { heroImageUrl, gallery: limited };
}

export type ProposalPhotoPickerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availablePhotos: string[];
  value: ProposalPhotoSelection;
  onSave: (selection: ProposalPhotoSelection) => Promise<boolean>;
  disabled?: boolean;
  error?: string;
  coverPageIncluded?: boolean;
};

/** Mount for each opening so Cancel discards this modal's unsaved choices. */
export function ProposalPhotoPicker({ open, onOpenChange, availablePhotos, value, onSave, disabled = false, error, coverPageIncluded = true }: ProposalPhotoPickerProps) {
  const [initial] = useState(() => initialSelection(value, availablePhotos));
  const [selection, setSelection] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const pending = useRef(false);
  const helpId = useId();
  const limitId = useId();
  const photos = useMemo(() => uniquePhotos([...availablePhotos, ...value.gallery, value.heroImageUrl]), [availablePhotos, value.gallery, value.heroImageUrl]);
  const blocked = disabled || saving;
  const full = selection.gallery.length >= MAX_PHOTOS;
  const dirty = !saved && (selection.heroImageUrl !== initial.heroImageUrl || JSON.stringify(selection.gallery) !== JSON.stringify(initial.gallery));
  const valid = Boolean(selection.heroImageUrl) && selection.gallery.includes(selection.heroImageUrl) && selection.gallery.length <= MAX_PHOTOS;

  function chooseCover(photo: string) {
    if (blocked || pending.current || (full && !selection.gallery.includes(photo))) return;
    setSaveError(null);
    setSelection(current => ({ heroImageUrl: photo, gallery: current.gallery.includes(photo) ? current.gallery : [...current.gallery, photo] }));
  }

  function toggleGallery(photo: string) {
    if (blocked || pending.current || photo === selection.heroImageUrl) return;
    setSaveError(null);
    setSelection(current => ({ ...current, gallery: current.gallery.includes(photo)
      ? current.gallery.filter(item => item !== photo)
      : current.gallery.length < MAX_PHOTOS ? [...current.gallery, photo] : current.gallery }));
  }

  async function save() {
    if (blocked || pending.current || !valid) return;
    pending.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      if (await onSave({ heroImageUrl: selection.heroImageUrl, gallery: [...selection.gallery] })) {
        setSaved(true);
        onOpenChange(false);
      } else {
        setSaveError("Couldn’t save photos. Your choices are kept. Try again.");
      }
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Couldn’t save photos. Your choices are kept. Try again.");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return <>
    <UnsavedListingGuard dirty={open && dirty} description="Your photo changes aren’t saved. Stay to save, or discard them and leave." />
    <Dialog open={open} onOpenChange={next => { if (!pending.current) onOpenChange(next); }}>
      <DialogContent data-theme="staypack-workspace" showCloseButton={false} aria-busy={saving} className="flex max-h-[90dvh] w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden rounded-2xl bg-base-100 p-0 text-base-content sm:max-w-3xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-base-300 p-5 sm:px-6">
          <div>
            <DialogTitle className="text-xl leading-tight">Proposal photos</DialogTitle>
            <DialogDescription className="mt-2 text-sm text-base-content/70">The cover appears on the digital proposal’s cover page. Other photos appear only in template photo sections or supported PDF layouts.</DialogDescription>
          </div>
          <DialogClose disabled={saving} aria-label="Cancel photo changes" className="du-btn du-btn-sm du-btn-ghost du-btn-circle size-11 shrink-0"><X className="size-4" aria-hidden="true" /></DialogClose>
        </div>
        <div className="min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6">
          {!coverPageIncluded && <p className="mb-4 rounded-lg bg-base-200 px-3 py-2 text-sm">Turn on the cover page in Edit pages to show your cover photo.</p>}
          {photos.length ? <>
            <div className="mb-4 space-y-2">
              <p role="status" aria-label="Selected proposal photos" className="text-sm font-medium">{selection.gallery.length} of {MAX_PHOTOS} photos selected</p>
              <p id={helpId} className="text-xs leading-relaxed text-base-content/70">Choose another cover before removing the current one.</p>
              {full && <p id={limitId} className="rounded-lg bg-base-200 px-3 py-2 text-sm">{MAX_PHOTOS}-photo limit reached. Deselect a photo before choosing another.</p>}
              {uniquePhotos(value.gallery).length > MAX_PHOTOS && <p className="text-sm text-base-content/70">Selection reduced to {MAX_PHOTOS} photos, keeping your cover. Review before saving.</p>}
            </div>
            <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:grid-cols-3">
              {photos.map((photo, index) => {
                const cover = photo === selection.heroImageUrl;
                const included = selection.gallery.includes(photo);
                const atLimit = full && !included;
                return <article key={photo} aria-label={`Photo ${index + 1}`} className={cn("du-card du-card-border min-w-0 overflow-hidden bg-base-100", cover && "border-primary")}>
                  <figure className="aspect-[4/3] bg-base-200"><PhotoThumbnail src={photo} index={index} /></figure>
                  <div className="du-card-body gap-2 p-3">
                    <p className="text-sm font-medium">Photo {index + 1}</p>
                    <button type="button" disabled={blocked || atLimit} aria-pressed={cover} aria-label={cover ? `Photo ${index + 1} is the cover photo` : `Make photo ${index + 1} the cover`} aria-describedby={atLimit ? limitId : undefined} className={cn("du-btn du-btn-sm min-h-11 h-auto w-full whitespace-normal py-2", cover ? "du-btn-primary" : "du-btn-outline")} onClick={() => chooseCover(photo)}>
                      {cover ? <Check className="size-4 shrink-0" aria-hidden="true" /> : <Star className="size-4 shrink-0" aria-hidden="true" />}{cover ? "Cover photo" : "Make cover"}
                    </button>
                    <label className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="checkbox" className="du-checkbox du-checkbox-sm" aria-label={`Select photo ${index + 1}`} aria-describedby={cover ? helpId : atLimit ? limitId : undefined} checked={included} disabled={blocked || cover || atLimit} onChange={() => toggleGallery(photo)} />
                      <span>Select photo</span>
                    </label>
                    {atLimit && <p className="text-xs text-base-content/70">Deselect a photo first.</p>}
                  </div>
                </article>;
              })}
            </div>
          </> : <div className="rounded-xl border border-dashed border-base-300 px-5 py-8 text-center">
            <ImageIcon className="mx-auto mb-3 size-7 text-base-content/60" aria-hidden="true" />
            <p className="font-medium">No property photos available</p>
            <p className="mt-2 text-sm text-base-content/70">Add photos to the property, then reopen this picker.</p>
          </div>}
        </div>
        <div className="shrink-0 space-y-3 border-t border-base-300 p-4 sm:px-6">
          {(error || saveError) && <p role="alert" className="du-alert du-alert-error du-alert-soft text-sm">{error || saveError}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <DialogClose disabled={saving} className="du-btn du-btn-sm du-btn-ghost min-h-11 flex-1 sm:flex-none">Cancel</DialogClose>
            <button type="button" disabled={blocked || !valid} className="du-btn du-btn-sm du-btn-primary min-h-11 flex-1 sm:flex-none" onClick={() => void save()}>
              {saving && <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" />}{saving ? "Saving photos…" : "Save photos"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </>;
}

function PhotoThumbnail({ src, index }: { src: string; index: number }) {
  const [failed, setFailed] = useState(false);
  return failed ? <span className="flex h-full w-full items-center justify-center gap-2 p-3 text-sm text-base-content/70"><ImageIcon className="size-4 shrink-0" aria-hidden="true" />Photo unavailable</span>
    // eslint-disable-next-line @next/next/no-img-element
    : <img src={src} alt={`Property photo ${index + 1}`} loading={index < 3 ? "eager" : "lazy"} onError={() => setFailed(true)} className="h-full w-full object-cover" />;
}

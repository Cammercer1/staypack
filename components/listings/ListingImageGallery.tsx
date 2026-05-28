"use client";

import { useState } from "react";
import { X } from "lucide-react";

type Props = {
  images: string[];
  address: string;
};

function PhotoModal({
  images,
  address,
  onClose,
}: {
  images: string[];
  address: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/95">
      <div className="sticky top-0 z-10 flex items-center justify-between bg-black/80 px-6 py-4 backdrop-blur-sm">
        <p className="text-sm font-medium text-white/60">
          {images.length} photos · {address}
        </p>
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-white/60 transition-colors hover:text-white"
        >
          <X className="h-5 w-5" />
          Close
        </button>
      </div>
      <div className="mx-auto max-w-4xl space-y-2 px-6 py-6 pb-16">
        {images.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={src}
            src={src}
            alt={`${address} — photo ${i + 1}`}
            className="w-full object-cover"
          />
        ))}
      </div>
    </div>
  );
}

export function ListingImageGallery({ images, address }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  if (images.length === 0) return null;

  // Mobile-only floating button (col3 bar handles desktop)
  const MobileShowAllButton = () => (
    <button
      onClick={() => setModalOpen(true)}
      className="absolute bottom-3 right-3 flex items-center justify-between gap-6 bg-black/70 px-4 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/85"
    >
      Show All Photos
      <span className="text-white/50">{images.length}</span>
    </button>
  );

  // ── Desktop multi-col layout ────────────────────────────────────────────────
  // col 1: flex-[2], single image full height
  // col 2: flex-[1], 2 equal rows
  // col 3: flex-[1], 2 unequal rows (top flex-[2], bottom flex-[3])
  //
  // "Show All Photos" lives on the last non-null cell in reading order.
  function desktopImg(src: string | undefined, alt: string) {
    if (!src) return null;
    return (
      <div className="relative h-full min-h-0 w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          className="absolute inset-0 h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <>
      {/* ── Mobile: single hero + button ──────────────────── */}
      <div className="relative md:hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[0]}
          alt={address}
          className="aspect-[4/3] w-full object-cover"
        />
        <MobileShowAllButton />
      </div>

      {/* ── Desktop gallery ───────────────────────────────── */}
      <div className="hidden h-[480px] min-h-0 gap-1 overflow-hidden md:flex">

        {/* Col 1 — hero, full height, 2/4 width */}
        <div className="relative min-h-0 flex-[2] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[0]}
            alt={`${address} — 1`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>

        {/* Col 2 — two equal rows, 1/4 width */}
        {images[1] || images[2] ? (
          <div className="flex min-h-0 flex-[1] flex-col gap-1 overflow-hidden">
            <div className="relative min-h-0 flex-1 overflow-hidden">
              {desktopImg(images[1], `${address} — 2`)}
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden">
              {desktopImg(images[2], `${address} — 3`)}
            </div>
          </div>
        ) : null}

        {/* Col 3 — single image + Show All Photos bar */}
        {images[3] ? (
          <div className="flex min-h-0 flex-[1] flex-col gap-1 overflow-hidden">
            <div className="relative min-h-0 flex-1 overflow-hidden">
              {desktopImg(images[3], `${address} — 4`)}
            </div>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex shrink-0 items-center justify-between bg-black/80 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-black"
            >
              Show All Photos
              <span className="text-white/50">{images.length}</span>
            </button>
          </div>
        ) : null}
      </div>

      {/* ── Lightbox modal ────────────────────────────────── */}
      {modalOpen ? (
        <PhotoModal
          images={images}
          address={address}
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </>
  );
}

"use client";

import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReportImageSlot } from "@/lib/reports/editable/reportImageSlots";
import { useReportEditableContext } from "@/components/reports/inline/ReportEditableContext";

type Props = {
  slot: ReportImageSlot;
  src: string;
  alt?: string;
  className?: string;
  imgClassName?: string;
};

export function ReportEditableImage({
  slot,
  src,
  alt = "",
  className,
  imgClassName,
}: Props) {
  const { editable, openImagePicker } = useReportEditableContext();

  if (!editable || !src) {
    return (
      <div className={className}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={imgClassName} />
      </div>
    );
  }

  return (
    <button
      type="button"
      data-report-editable-image
      className={cn(
        "group relative block w-full cursor-pointer border-0 bg-transparent p-0 text-left",
        className,
      )}
      onClick={() => openImagePicker(slot)}
      aria-label="Change photo"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={imgClassName} />
      <span
        className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100"
        aria-hidden
      >
        <span className="flex items-center gap-1.5 rounded-md bg-white/95 px-2.5 py-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-neutral-900 shadow">
          <ImageIcon className="h-3.5 w-3.5" />
          Change photo
        </span>
      </span>
    </button>
  );
}

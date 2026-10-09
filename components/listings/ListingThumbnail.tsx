"use client";

import { useState } from "react";
import { House } from "lucide-react";
import { cn } from "@/lib/utils";

export function ListingThumbnail({
  src,
  address,
  className,
  eager = false,
}: {
  src: string | null;
  address: string;
  className?: string;
  eager?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  return (
    <div
      className={cn(
        "flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-base-200 text-base-content/45",
        className,
      )}
    >
      {src && failedSrc !== src ? (
        // Listing photos come from agency uploads and multiple external hosts.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={address}
          width={160}
          height={120}
          loading={eager ? "eager" : "lazy"}
          className="h-full w-full object-cover"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <House className="size-7" aria-label="No property photo" />
      )}
    </div>
  );
}

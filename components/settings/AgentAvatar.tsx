"use client";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function AgentAvatar({
  name,
  src,
  className,
  loading = "eager",
}: {
  name: string;
  src?: string | null;
  className?: string;
  loading?: "eager" | "lazy";
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "?";
  return (
    <div
      className={cn(
        "flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-medium text-foreground ring-1 ring-border/60",
        className,
        (loading = "eager"),
      )}
    >
      {src && failed !== src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          loading={loading}
          ref={(element) => {
            // A cached image can fail before React hydrates the server HTML.
            if (element?.complete && element.naturalWidth === 0) setFailed(src);
          }}
          alt=""
          width={80}
          height={80}
          className="size-full object-cover"
          onError={() => setFailed(src)}
        />
      ) : (
        <span aria-label={`${name || "Agent"} initials`}>{initials}</span>
      )}
    </div>
  );
}

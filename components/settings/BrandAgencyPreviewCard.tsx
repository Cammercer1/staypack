"use client";

import type { AgencyInput } from "@/lib/validation/schemas";

export function BrandAgencyPreviewCard({ preview }: { preview: AgencyInput }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/20">
      <div className="border-b border-border/60 bg-background px-5 py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Public contact
        </p>
        <p className="mt-1 font-display text-lg font-semibold tracking-tight">
          {preview.name || "Your agency"}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Report links use{" "}
          <span className="font-mono text-foreground">
            /{preview.slug || "your-slug"}
          </span>
        </p>
      </div>
      <dl className="space-y-3 px-5 py-4 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Website</dt>
          <dd className="mt-0.5 font-medium">
            {preview.website_url?.trim() || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Email</dt>
          <dd className="mt-0.5 font-medium">{preview.email?.trim() || "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Phone</dt>
          <dd className="mt-0.5 font-medium">{preview.phone?.trim() || "—"}</dd>
        </div>
      </dl>
    </div>
  );
}

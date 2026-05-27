"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function DownloadPdfButton({ url }: { url?: string | null }) {
  if (!url) {
    return (
      <Button variant="outline" size="sm" disabled>
        Download PDF
      </Button>
    );
  }

  return (
    <Link href={url} target="_blank">
      <Button variant="outline" size="sm">
        Download PDF
      </Button>
    </Link>
  );
}

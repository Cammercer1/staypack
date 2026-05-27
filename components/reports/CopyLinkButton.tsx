"use client";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyLinkButton({ url }: { url?: string | null }) {
  async function copyLink() {
    if (!url) {
      toast.error("No public link yet");
      return;
    }

    await navigator.clipboard.writeText(url);
    toast.success("Public link copied");
  }

  return (
    <Button variant="outline" size="sm" onClick={copyLink} disabled={!url}>
      Copy link
    </Button>
  );
}

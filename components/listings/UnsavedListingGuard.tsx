"use client";
import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function UnsavedListingGuard({ dirty }: { dirty: boolean }) {
  const leaving = useRef(false);
  const [destination, setDestination] = useState<string | null>(null);
  useEffect(() => {
    if (!dirty) return;
    function unload(event: BeforeUnloadEvent) {
      if (leaving.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    function navigate(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!link || link.target === "_blank" || link.hasAttribute("download"))
        return;
      const url = new URL(link.href, window.location.href);
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      setDestination(link.href);
    }
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", navigate, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", navigate, true);
    };
  }, [dirty]);
  return (
    <Dialog
      open={!!destination}
      onOpenChange={(open) => {
        if (!open) setDestination(null);
      }}
    >
      <DialogContent>
        <DialogTitle>Leave without saving?</DialogTitle>
        <DialogDescription>
          Your property details or photo selections have unsaved changes. Stay
          to save them, or discard them and leave.
        </DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={() => setDestination(null)}>
            Keep editing
          </Button>
          <Button
            onClick={() => {
              const target = destination;
              setDestination(null);
              if (target) {
                leaving.current = true;
                window.location.assign(target);
              }
            }}
          >
            Discard and leave
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

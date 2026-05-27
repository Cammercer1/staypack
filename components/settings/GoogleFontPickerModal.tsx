"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  buildGoogleFontStylesheetUrl,
  getFontDisplayName,
  GOOGLE_FONT_CATEGORIES,
  type GoogleFontCategory,
  type GoogleFontListItem,
} from "@/lib/branding/google-fonts";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  value: string;
  onSelect: (fontId: string) => void;
};

const PREVIEW_TEXT = "Short-Term Rental Potential Report";

export function GoogleFontPickerModal({
  open,
  onOpenChange,
  title,
  description,
  value,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<GoogleFontCategory>("All");
  const [fonts, setFonts] = useState<GoogleFontListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [previewFamilies, setPreviewFamilies] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);

      const params = new URLSearchParams({
        limit: "120",
      });

      if (query.trim()) {
        params.set("q", query.trim());
      }

      if (category !== "All") {
        params.set("category", category);
      }

      try {
        const response = await fetch(`/api/google-fonts?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = await response.json();

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load fonts");
        }

        setFonts(payload.fonts ?? []);
        setTotal(payload.total ?? 0);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setFonts([]);
          setTotal(0);
        }
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [open, query, category]);

  useEffect(() => {
    if (!open || fonts.length === 0) {
      return;
    }

    const families = fonts.slice(0, 24).map((font) => font.family);
    setPreviewFamilies(families);
  }, [fonts, open]);

  const previewUrl = useMemo(
    () =>
      buildGoogleFontStylesheetUrl(previewFamilies, {
        text: PREVIEW_TEXT,
        weights: "400;600",
      }),
    [previewFamilies],
  );

  const selectedLabel = getFontDisplayName(value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[min(85vh,760px)] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 border-b px-5 py-4">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search 1,900+ Google Fonts..."
              className="h-11 pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {GOOGLE_FONT_CATEGORIES.map((item) => (
              <Button
                key={item}
                type="button"
                size="sm"
                variant={category === item ? "default" : "outline"}
                onClick={() => setCategory(item)}
              >
                {item}
              </Button>
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            {loading
              ? "Loading fonts from Google Fonts..."
              : `${total.toLocaleString()} fonts found · currently selected: ${selectedLabel}`}
          </p>
        </div>

        {previewUrl ? <link rel="stylesheet" href={previewUrl} /> : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading Google Fonts...
            </div>
          ) : fonts.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              No fonts matched your search.
            </div>
          ) : (
            <div className="space-y-2">
              {fonts.map((font) => {
                const isSelected =
                  value === font.family ||
                  getFontDisplayName(value).toLowerCase() ===
                    font.family.toLowerCase();

                return (
                  <button
                    key={font.family}
                    type="button"
                    onClick={() => {
                      onSelect(font.family);
                      onOpenChange(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors hover:bg-muted/60",
                      isSelected && "border-primary bg-primary/5",
                    )}
                  >
                    <div>
                      <p
                        className="text-lg leading-none"
                        style={{ fontFamily: `"${font.family}", ${font.category === "Serif" || font.category === "Display" ? "Georgia, serif" : "system-ui, sans-serif"}` }}
                      >
                        {font.family}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {font.category}
                      </p>
                    </div>
                    {isSelected ? (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

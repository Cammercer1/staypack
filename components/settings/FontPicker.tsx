"use client";

import { cn } from "@/lib/utils";

import { useEffect, useId, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  getFontDisplayName,
  POPULAR_BODY_FONTS,
  POPULAR_HEADING_FONTS,
  type GoogleFontListItem,
} from "@/lib/branding/google-fonts";
import { uploadBrandAsset } from "@/lib/branding/assetUpload";
import type { AgencyInput } from "@/lib/validation/schemas";

type Props = {
  form: UseFormReturn<AgencyInput>;
  agencyId?: string;
  onUploadStateChange?: (busy: boolean) => void;
};

function FontField({
  target,
  form,
  onUploadStateChange,
}: Props & { target: "heading" | "body" }) {
  const id = useId();
  const label = target === "heading" ? "Heading font" : "Body font";
  const familyField =
    target === "heading" ? "heading_font_family" : "body_font_family";
  const fileField =
    target === "heading" ? "heading_font_file_url" : "body_font_file_url";
  const value = form.watch(familyField);
  const file = form.watch(fileField);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GoogleFontListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  useEffect(() => {
    if (query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/google-fonts?${new URLSearchParams({ q: query.trim(), limit: "10" })}`,
          { signal: controller.signal },
        );
        const payload = await response.json();
        if (!response.ok)
          throw new Error(
            "Font search is unavailable. Try again or choose a popular font.",
          );
        if (!controller.signal.aborted) {
          setResults(payload.fonts ?? []);
          setOpen(true);
        }
      } catch {
        if (!controller.signal.aborted)
          setError(
            "Font search is unavailable. Try again or choose a popular font.",
          );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);
  useEffect(() => {
    if (open && active >= 0)
      document
        .getElementById(`${id}-option-${active}`)
        ?.scrollIntoView?.({ block: "nearest" });
  }, [active, id, open]);

  function search(next: string) {
    setQuery(next);
    setResults([]);
    setActive(-1);
    setError("");
    setOpen(next.trim().length >= 2);
    setLoading(next.trim().length >= 2);
  }
  function removeFile() {
    form.setValue(fileField, "", { shouldDirty: true });
    if (target === "body")
      form.setValue("font_file_url", "", { shouldDirty: true });
  }
  function select(family: string) {
    form.setValue(familyField, family, { shouldDirty: true });
    removeFile();
    search("");
  }
  async function upload(file: File) {
    setUploadError("");
    setUploading(true);
    onUploadStateChange?.(true);
    try {
      const url = await uploadBrandAsset(
        file,
        target === "heading" ? "heading-font" : "body-font",
      );
      form.setValue(fileField, url, { shouldDirty: true });
      if (target === "body")
        form.setValue("font_file_url", url, { shouldDirty: true });
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "Upload failed. Please try again.",
      );
    } finally {
      setUploading(false);
      onUploadStateChange?.(false);
    }
  }
  return (
    <section className="space-y-3">
      <div>
        <h3 className="font-medium">{label}</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          {target === "heading"
            ? "Titles, addresses and section headings."
            : "Descriptions, contact details and small print."}
        </p>
      </div>
      <p className="text-sm">
        <span className="text-muted-foreground">Selected: </span>
        {file ? "Custom font" : getFontDisplayName(value)}
      </p>
      <div className="relative">
        <label className="sr-only" htmlFor={id}>
          Search {label.toLowerCase()}s
        </label>
        <Input
          aria-label={`Search ${label.toLowerCase()}s`}
          id={id}
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls={`${id}-results`}
          aria-expanded={open}
          aria-activedescendant={
            open && active >= 0 ? `${id}-option-${active}` : undefined
          }
          value={query}
          placeholder="Search Google Fonts…"
          onChange={(event) => search(event.target.value)}
          onFocus={() => {
            if (results.length) setOpen(true);
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              return;
            }
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              setActive((current) =>
                results.length
                  ? current === -1
                    ? event.key === "ArrowDown"
                      ? 0
                      : results.length - 1
                    : (current +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        results.length) %
                      results.length
                  : -1,
              );
            }
            if (event.key === "Enter" && open) {
              event.preventDefault();
              if (results[active]) select(results[active].family);
            }
          }}
        />
        {open && (
          <ul
            id={`${id}-results`}
            role="listbox"
            aria-label={`${label} results`}
            className="absolute z-20 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-border bg-background p-1 shadow-md"
          >
            {results.map((font, index) => (
              <li
                key={font.family}
                id={`${id}-option-${index}`}
                role="option"
                aria-selected={index === active}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-2 text-sm",
                  index === active ? "bg-muted" : "hover:bg-muted",
                )}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(font.family)}
              >
                {font.family}
              </li>
            ))}
            {!results.length && (
              <li
                role="presentation"
                className="px-3 py-2 text-sm text-muted-foreground"
              >
                {loading
                  ? "Searching…"
                  : error || "No matching fonts. Try another name."}
              </li>
            )}
          </ul>
        )}
      </div>
      <p className="sr-only" role="status">
        {loading
          ? "Searching fonts"
          : error || (query.length >= 2 ? `${results.length} fonts found` : "")}
      </p>
      <div className="flex flex-wrap gap-2">
        {(target === "heading"
          ? POPULAR_HEADING_FONTS
          : POPULAR_BODY_FONTS
        ).map((font) => (
          <Button
            key={font}
            type="button"
            variant={!file && value === font ? "default" : "outline"}
            size="sm"
            aria-pressed={!file && value === font}
            onClick={() => select(font)}
          >
            {getFontDisplayName(font)}
          </Button>
        ))}
      </div>
      <details
        className="rounded-lg border border-border/60 p-3"
        open={file ? true : undefined}
      >
        <summary className="cursor-pointer text-sm font-medium">
          {file ? "Custom font attached" : "Use a custom font"}
        </summary>
        <div className="mt-3 space-y-3">
          <label className="block text-sm" htmlFor={`${id}-upload`}>
            Upload {label.toLowerCase()}
          </label>
          <input
            aria-label={`Upload ${label.toLowerCase()}`}
            id={`${id}-upload`}
            type="file"
            accept=".woff,.woff2,.ttf,.otf"
            disabled={uploading}
            className="block w-full min-w-0 text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-background file:px-3 file:py-2"
            onChange={(event) => {
              const input = event.currentTarget;
              const file = input.files?.[0];
              if (file)
                void upload(file).finally(() => {
                  input.value = "";
                });
            }}
          />
          <p className="text-xs text-muted-foreground">
            WOFF, WOFF2, TTF or OTF · Up to 10 MB. Choosing a Google font
            replaces the custom font.
          </p>
          {uploading && (
            <p role="status" className="text-sm">
              Uploading…
            </p>
          )}
          {file && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={removeFile}
            >
              Remove custom {target} font
            </Button>
          )}
          {uploadError && (
            <p role="alert" className="text-sm text-destructive">
              {uploadError}
            </p>
          )}
        </div>
      </details>
    </section>
  );
}

export function FontPicker(props: Props) {
  return (
    <div className="space-y-7 divide-y divide-border/60 [&>section+section]:pt-7">
      <FontField {...props} target="heading" />
      <FontField {...props} target="body" />
    </div>
  );
}

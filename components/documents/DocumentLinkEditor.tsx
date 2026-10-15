"use client";

import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { Link2, Loader2, Pencil, QrCode } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  documentLinkSchema,
  type DocumentLinkFields,
} from "@/lib/documents/documentLink";

type Props = {
  document: DocumentLinkFields & { assets: { qr_code_url?: string } };
  endpoint: string;
  allowReport?: boolean;
  disabled?: boolean;
  immediate?: boolean;
  draftPdf?: boolean;
  onPendingChange?: (pending: boolean) => void;
  onSaved: (payload: Record<string, unknown>) => void;
};

export function DocumentLinkEditor(props: Props) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [saveRevision, setSaveRevision] = useState(0);
  useEffect(() => {
    // A saved destination remounts the keyed form, including its trigger.
    if (saveRevision) triggerRef.current?.focus({ preventScroll: true });
  }, [saveRevision]);
  const link =
    props.document.document_link_draft?.link ?? props.document.document_link;
  const signature = JSON.stringify([
    link,
    props.document.assets.qr_code_url,
    props.endpoint,
  ]);
  return <DocumentLinkForm key={signature} {...props} triggerRef={triggerRef} onSaved={payload => {
    props.onSaved(payload);
    setSaveRevision(revision => revision + 1);
  }} />;
}

function DocumentLinkForm({
  document,
  endpoint,
  allowReport = false,
  disabled,
  immediate,
  draftPdf,
  onSaved,
  onPendingChange,
  triggerRef,
}: Props & { triggerRef: RefObject<HTMLButtonElement | null> }) {
  const id = useId();
  const saved = document.document_link_draft?.link ?? document.document_link;
  const legacy = !saved && Boolean(document.assets.qr_code_url);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isDirty },
  } = useForm({
    defaultValues: {
      mode: saved?.mode ?? (legacy ? "legacy" : "none"),
      url: saved?.mode === "custom" ? saved.url : "",
    },
  });
  const mode = useWatch({ control, name: "mode" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const pending = useRef(false);
  const destination =
    saved?.mode === "custom"
      ? saved.url
      : saved?.mode === "report"
        ? "This report online"
        : legacy
          ? "Existing QR code"
          : "No link or QR code";

  useEffect(() => {
    onPendingChange?.(open && (isDirty || saving));
    return () => onPendingChange?.(false);
  }, [open, isDirty, saving, onPendingChange]);

  function changeOpen(next: boolean) {
    if (saving || pending.current || (next && disabled)) return;
    reset();
    setError("");
    setOpen(next);
  }

  async function save(values: { mode: string; url: string }) {
    if (disabled || pending.current || !isDirty) return;
    setError("");
    const parsed = documentLinkSchema.safeParse(values);
    if (!parsed.success) {
      setError("Enter a valid http or https destination URL.");
      return;
    }
    pending.current = true;
    setSaving(true);
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to save link");
      reset(values);
      setOpen(false);
      onSaved(payload);
      toast.success(
        immediate
          ? "Link saved"
          : draftPdf
            ? "Link saved for your next PDF. Publish again to update the online report."
            : "Link saved. Publish to apply it to the document.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save link");
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  return (
    <div
      data-theme="staypack-workspace"
      className="min-w-0 rounded-xl border border-base-300 bg-base-100 p-4 text-base-content"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <QrCode className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h4 className="text-sm font-semibold">Link and QR code</h4>
            <p className="mt-1 break-all text-xs text-base-content/65">
              {destination}
            </p>
          </div>
        </div>
        <button
          ref={triggerRef}
          type="button"
          className="du-btn du-btn-sm du-btn-ghost min-h-11 shrink-0"
          disabled={disabled}
          onClick={() => changeOpen(true)}
        >
          <Pencil className="size-4" aria-hidden="true" /> Edit link &amp; QR
        </button>
      </div>
      {document.document_link_draft && !immediate ? (
        <p className="mt-3 text-xs text-base-content/65">
          {draftPdf
            ? "Saved for your next PDF. Publish again to update the online report."
            : "Saved for your next publication. Publish again to apply this change."}
        </p>
      ) : null}
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent
          finalFocus={triggerRef}
          data-theme="staypack-workspace"
          className="max-h-[90dvh] overflow-y-auto rounded-2xl border border-base-300 bg-base-100 p-5 text-base-content sm:max-w-lg sm:p-6"
          showCloseButton={false}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Link2 className="size-5" aria-hidden="true" /> Link and QR code
            </DialogTitle>
            <DialogDescription className="text-base-content/65">
              Choose where the link and QR code in this document take your
              customer.
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => void handleSubmit(save)(event)}
            noValidate
            className="space-y-5"
            aria-label="Document link"
          >
            <div className="space-y-2 text-sm">
              <label className="font-medium" htmlFor={`${id}-destination`}>
                Destination
              </label>
              <select
                id={`${id}-destination`}
                aria-label="Destination"
                {...register("mode")}
                disabled={disabled || saving}
                className="du-select min-h-11 w-full border-base-300 bg-base-100"
              >
                {legacy ? (
                  <option value="legacy">Keep existing QR code</option>
                ) : null}
                <option value="none">No link or QR code</option>
                {allowReport ? (
                  <option value="report">This report online</option>
                ) : null}
                <option value="custom">Custom website URL</option>
              </select>
            </div>
            {mode === "custom" ? (
              <div className="space-y-2 text-sm">
                <label className="font-medium" htmlFor={`${id}-url`}>
                  Website URL
                </label>
                <input
                  id={`${id}-url`}
                  aria-label="Website URL"
                  {...register("url")}
                  type="url"
                  placeholder="https://agency.com.au/property"
                  disabled={disabled || saving}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `${id}-error` : undefined}
                  className="du-input min-h-11 w-full border-base-300 bg-base-100"
                />
              </div>
            ) : null}
            {!immediate ? (
              <p className="rounded-xl bg-base-200 p-3 text-sm text-base-content/70">
                {draftPdf
                  ? "This choice will apply to your next PDF. Publish again to update the online report."
                  : "This choice will apply when you next publish the document."}
              </p>
            ) : null}
            {error ? (
              <p
                id={`${id}-error`}
                role="alert"
                className="du-alert du-alert-error text-sm"
              >
                {error}
              </p>
            ) : null}
            <div className="flex flex-col-reverse gap-2 border-t border-base-300 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="du-btn du-btn-ghost min-h-11"
                disabled={saving}
                onClick={() => changeOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="du-btn du-btn-primary min-h-11"
                disabled={disabled || saving || !isDirty || mode === "legacy"}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : null}
                {saving ? "Saving…" : "Save link choice"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

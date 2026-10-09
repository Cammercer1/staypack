"use client";

import { useEffect, useId, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { documentLinkSchema, type DocumentLinkFields } from "@/lib/documents/documentLink";

type Props = {
  document: DocumentLinkFields & { assets: { qr_code_url?: string } };
  endpoint: string;
  allowReport?: boolean;
  disabled?: boolean;
  immediate?: boolean;
  onPendingChange?: (pending: boolean) => void;
  onSaved: (payload: Record<string, unknown>) => void;
};

export function DocumentLinkEditor(props: Props) {
  const link = props.document.document_link_draft?.link ?? props.document.document_link;
  const signature = JSON.stringify([link, props.document.assets.qr_code_url, props.endpoint]);
  return <DocumentLinkForm key={signature} {...props} />;
}

function DocumentLinkForm({ document, endpoint, allowReport = false, disabled, immediate, onSaved, onPendingChange }: Props) {
  const id = useId();
  const saved = document.document_link_draft?.link ?? document.document_link;
  const legacy = !saved && Boolean(document.assets.qr_code_url);
  const { register, control, handleSubmit, formState: { isDirty } } = useForm({
    defaultValues: { mode: saved?.mode ?? (legacy ? "legacy" : "none"), url: saved?.mode === "custom" ? saved.url : "" },
  });
  const mode = useWatch({ control, name: "mode" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    onPendingChange?.(isDirty || saving);
    return () => onPendingChange?.(false);
  }, [isDirty, saving, onPendingChange]);

  async function save(values: { mode: string; url: string }) {
    setError("");
    const parsed = documentLinkSchema.safeParse(values);
    if (!parsed.success) { setError("Enter a valid http or https destination URL."); return; }
    setSaving(true);
    try {
      const response = await fetch(endpoint, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed.data) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to save link");
      onSaved(payload);
      toast.success(immediate ? "Link saved" : "Link saved. Publish to apply it to the document.");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to save link"); }
    finally { setSaving(false); }
  }

  return (
    <details className="rounded-xl border border-border bg-background p-4">
      <summary className="cursor-pointer text-sm font-medium">Link and QR code <span className="font-normal text-muted-foreground">· Optional</span></summary>
      <form onSubmit={handleSubmit(save)} className="mt-4 space-y-3" aria-label="Document link">
      <p className="text-sm text-muted-foreground">Choose a destination for this document. Each report has its own choice.</p>
      <div className="text-sm"><label htmlFor={`${id}-destination`}>Destination</label>
        <select id={`${id}-destination`} {...register("mode")} disabled={disabled || saving} className="mt-1 block w-full rounded-lg border border-border bg-background p-2">
          {legacy ? <option value="legacy">Keep existing QR code</option> : null}
          <option value="none">No link or QR code</option>
          {allowReport ? <option value="report">This report online</option> : null}
          <option value="custom">Custom website URL</option>
        </select>
      </div>
      {mode === "custom" ? <div className="text-sm"><label htmlFor={`${id}-url`}>Website URL</label>
        <input id={`${id}-url`} {...register("url")} type="url" placeholder="https://agency.com.au/property" disabled={disabled || saving} className="mt-1 block w-full rounded-lg border border-border bg-background p-2" />
      </div> : null}
      {document.document_link_draft && !immediate ? <p className="text-sm text-muted-foreground">Saved for the next publication. Your published document keeps its current QR until you publish again.</p> : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {isDirty ? <p className="text-sm text-muted-foreground">Save this choice before publishing.</p> : null}
      <Button type="submit" variant="outline" disabled={disabled || saving || !isDirty || mode === "legacy"}>{saving ? "Saving…" : "Save link choice"}</Button>
    </form>
    </details>
  );
}

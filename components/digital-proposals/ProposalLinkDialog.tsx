"use client";

import { useId } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpRight, Link2, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { proposalLinkSchema, type ProposalDraft } from "@/lib/digital-proposals/template";
import { cn } from "@/lib/utils";

type ProposalLink = ProposalDraft["links"][number];

export function ProposalLinkDialog({ link, editing, disabled, onSave, onClose }: {
  link: ProposalLink; editing: boolean; disabled: boolean;
  onSave: (link: ProposalLink) => void; onClose: () => void;
}) {
  const id = useId();
  const form = useForm<ProposalLink>({ defaultValues: link, resolver: zodResolver(proposalLinkSchema), mode: "onTouched" });
  const label = useWatch({ control: form.control, name: "label" });
  const { errors } = form.formState;

  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent data-theme="staypack-workspace" showCloseButton={false} className="max-h-[90dvh] overflow-y-auto bg-base-100 p-0 text-base-content sm:max-w-lg">
      <div className="flex items-start justify-between gap-4 border-b border-base-300 p-5 sm:p-6">
        <div>
          <DialogTitle className="text-lg font-semibold">{editing ? "Edit link" : "Add a link"}</DialogTitle>
          <DialogDescription className="mt-2 leading-relaxed text-base-content/65">Add a link to your website or an agreement.</DialogDescription>
        </div>
        <button type="button" className="du-btn du-btn-sm du-btn-ghost du-btn-square min-h-11 min-w-11 shrink-0" aria-label="Close link editor" onClick={onClose}><X size={18} aria-hidden="true" /></button>
      </div>
      <form noValidate onSubmit={form.handleSubmit(value => { if (!disabled) onSave(value); })}>
        <fieldset disabled={disabled} className="min-w-0 space-y-5 p-5 sm:p-6">
          <div>
            <label htmlFor={`${id}-label`} className="mb-2 block text-sm font-medium">Button label</label>
            <input id={`${id}-label`} aria-label="Button label" className={cn("du-input du-input-sm min-h-11 w-full", errors.label && "du-input-error")} placeholder="e.g. Review management agreement" maxLength={100} aria-invalid={Boolean(errors.label)} aria-describedby={errors.label ? `${id}-label-error` : undefined} {...form.register("label")} />
            {errors.label && <p id={`${id}-label-error`} role="alert" className="mt-2 text-xs text-error">Enter a button label of up to 100 characters.</p>}
          </div>
          <div>
            <label htmlFor={`${id}-url`} className="mb-2 block text-sm font-medium">Link URL</label>
            <label htmlFor={`${id}-url`} className={cn("du-input du-input-sm flex min-h-11 w-full items-center gap-2", errors.url && "du-input-error")}>
              <Link2 size={16} className="shrink-0 text-base-content/50" aria-hidden="true" />
              <input id={`${id}-url`} aria-label="Link URL" type="url" inputMode="url" autoCapitalize="none" autoComplete="url" spellCheck={false} className="min-w-0 grow" placeholder="https://" aria-invalid={Boolean(errors.url)} aria-describedby={`${id}-url-help`} {...form.register("url")} />
            </label>
            <p id={`${id}-url-help`} role={errors.url ? "alert" : undefined} className={cn("mt-2 text-xs leading-relaxed", errors.url ? "text-error" : "text-base-content/60")}>{errors.url ? "Enter a full HTTPS link without a username or password." : "Paste the full address, starting with https://."}</p>
          </div>
          <div>
            <label htmlFor={`${id}-kind`} className="mb-2 block text-sm font-medium">Link type</label>
            <select id={`${id}-kind`} aria-label="Link type" className="du-select du-select-sm min-h-11 w-full" {...form.register("kind")}>
              <option value="link">Website or document</option>
              <option value="sign">Review & sign</option>
            </select>
          </div>
          <div className="rounded-xl bg-base-200/60 p-4">
            <p className="mb-3 text-xs font-medium text-base-content/60">Button preview</p>
            <span className="inline-flex max-w-full items-center gap-2 rounded-lg border border-base-content/20 bg-base-100 px-4 py-2.5 text-sm font-medium"><span className="min-w-0 break-words">{label.trim() || "Your button label"}</span><ArrowUpRight size={16} className="shrink-0" aria-hidden="true" /></span>
          </div>
        </fieldset>
        <div className="flex flex-wrap justify-end gap-2 border-t border-base-300 bg-base-200/35 px-5 py-4 sm:px-6">
          <button type="button" className="du-btn du-btn-sm du-btn-ghost min-h-11" onClick={onClose}>Cancel</button>
          <button type="submit" className="du-btn du-btn-sm du-btn-primary min-h-11" disabled={disabled}>{editing ? "Save link" : "Add link"}<ArrowUpRight size={16} aria-hidden="true" /></button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}

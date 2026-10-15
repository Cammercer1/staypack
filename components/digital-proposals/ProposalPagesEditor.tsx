"use client";

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { UseFormReturn } from "react-hook-form";
import { ArrowDown, ArrowRight, ArrowUp, BarChart3, BriefcaseBusiness, FileText, GripVertical, House, Layers, Plus, Trash2, TrendingUp } from "lucide-react";
import type { ProposalDraft, ProposalPage } from "@/lib/digital-proposals/template";
import { cn } from "@/lib/utils";

const pageIcons = { hero: House, comparison: BarChart3, forecast: TrendingUp, evidence: Layers, text: FileText, service: BriefcaseBusiness, next_steps: ArrowRight };
type Drag = {
  id: string; pointerId: number; startY: number; sourceIndex: number; targetIndex: number;
  ids: string[]; centers: number[]; listTop: number; moved: boolean; handle: HTMLButtonElement; capture: HTMLOListElement;
};

function reordered<T>(items: T[], from: number, to: number): T[] {
  const result = [...items];
  result.splice(to, 0, result.splice(from, 1)[0]);
  return result;
}

export function ProposalPagesEditor({ form, draft, contentEditable = true, disabled = false }: {
  form: UseFormReturn<ProposalDraft>; draft: ProposalDraft; contentEditable?: boolean; disabled?: boolean;
}) {
  const [editingId, setEditingId] = useState(draft.pages[0]?.id);
  const [preview, setPreview] = useState<{ id: string; from: number; to: number } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  const rows = useRef(new Map<string, HTMLLIElement>());
  const drag = useRef<Drag | null>(null);
  const instructionsId = useId();
  const index = Math.max(0, draft.pages.findIndex(page => page.id === editingId));
  const page = draft.pages[index];
  const includedCount = draft.pages.filter(item => item.enabled).length;
  const visiblePages = preview ? reordered(draft.pages, preview.from, preview.to) : draft.pages;

  const cancelDrag = useCallback(() => {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    setPreview(null);
    setAnnouncement("Reordering cancelled. Page order unchanged.");
    if (current.capture.hasPointerCapture?.(current.pointerId)) current.capture.releasePointerCapture(current.pointerId);
  }, []);

  useEffect(() => {
    function onKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape" && drag.current) {
        event.preventDefault();
        cancelDrag();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("blur", cancelDrag);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("blur", cancelDrag);
      const current = drag.current;
      drag.current = null;
      if (current?.capture.hasPointerCapture?.(current.pointerId)) current.capture.releasePointerCapture(current.pointerId);
    };
  }, [cancelDrag]);

  function move(id: string, target: number) {
    if (disabled || drag.current) return;
    const pages = form.getValues("pages");
    const source = pages.findIndex(item => item.id === id);
    if (source < 0 || target < 0 || target >= pages.length || source === target) return;
    form.setValue("pages", reordered(pages, source, target), { shouldDirty: true });
    setAnnouncement(`Moved ${pages[source].title} to position ${target + 1} of ${pages.length}.`);
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, item: ProposalPage) {
    if (disabled || event.currentTarget.matches(":disabled") || event.button !== 0 || drag.current) return;
    const pages = form.getValues("pages");
    const sourceIndex = pages.findIndex(page => page.id === item.id);
    if (sourceIndex < 0) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    drag.current = {
      id: item.id, pointerId: event.pointerId, startY: event.clientY, sourceIndex, targetIndex: sourceIndex,
      ids: pages.map(page => page.id), centers: pages.map(page => {
        const rect = rows.current.get(page.id)!.getBoundingClientRect();
        return rect.top + rect.height / 2;
      }), listTop: listRef.current!.getBoundingClientRect().top, moved: false, handle: event.currentTarget, capture: listRef.current!,
    };
    listRef.current!.setPointerCapture?.(event.pointerId);
  }

  function updateDrag(event: PointerEvent<HTMLOListElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (disabled || current.handle.matches(":disabled")) { cancelDrag(); return; }
    if (!current.moved && Math.abs(event.clientY - current.startY) < 5) return;
    event.preventDefault();
    current.moved = true;
    const scrollOffset = listRef.current!.getBoundingClientRect().top - current.listTop;
    const target = current.centers.filter((center, i) => i !== current.sourceIndex && event.clientY > center + scrollOffset).length;
    current.targetIndex = target;
    setPreview(previous => previous?.id === current.id && previous.to === target ? previous : { id: current.id, from: current.sourceIndex, to: target });
  }

  function finishDrag(event: PointerEvent<HTMLOListElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const pages = form.getValues("pages");
    const sameOrder = pages.length === current.ids.length && pages.every((page, i) => page.id === current.ids[i]);
    drag.current = null;
    setPreview(null);
    if (!disabled && !current.handle.matches(":disabled") && sameOrder && current.moved && current.sourceIndex !== current.targetIndex) {
      form.setValue("pages", reordered(pages, current.sourceIndex, current.targetIndex), { shouldDirty: true });
      setAnnouncement(`Moved ${pages[current.sourceIndex].title} to position ${current.targetIndex + 1} of ${pages.length}.`);
    }
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function keyboardMove(event: KeyboardEvent<HTMLButtonElement>, id: string, position: number) {
    const target = { ArrowUp: position - 1, ArrowDown: position + 1, Home: 0, End: draft.pages.length - 1 }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    move(id, target);
  }

  function togglePage(id: string, enabled: boolean) {
    if (disabled || drag.current) return;
    const pages = form.getValues("pages");
    const position = pages.findIndex(item => item.id === id);
    const item = pages[position];
    if (!item || (!contentEditable && item.kind === "text" && !item.body.trim())) return;
    if (!enabled && pages.filter(item => item.enabled).length <= 1) return;
    form.setValue(`pages.${position}.enabled`, enabled, { shouldDirty: true });
    setAnnouncement(`${item.title} ${enabled ? "included in" : "hidden from"} the proposal.`);
  }

  function addPage() {
    if (disabled || draft.pages.length >= 12 || drag.current) return;
    const id = `page-${crypto.randomUUID()}`;
    form.setValue("pages", [...form.getValues("pages"), { id, kind: "text", title: "New page", body: "", enabled: true }], { shouldDirty: true });
    setEditingId(id);
  }

  function removePage() {
    if (disabled || !page || drag.current) return;
    const remaining = form.getValues("pages").filter(item => item.id !== page.id);
    if (!remaining.some(item => item.enabled)) return;
    form.setValue("pages", remaining, { shouldDirty: true });
    setEditingId(remaining[0]?.id);
  }

  return <div className="min-w-0 space-y-4">
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Proposal pages</h2>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-base-200 px-2.5 py-1 text-[11px] font-medium tabular-nums text-base-content/70">{includedCount} included</span>
          {contentEditable && <button className="du-btn du-btn-sm du-btn-ghost" type="button" disabled={disabled || draft.pages.length >= 12} onClick={addPage}><Plus size={15} />Add</button>}
        </div>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-base-content/60">Drag to reorder. Choose which pages to include.</p>
      <p id={instructionsId} className="sr-only">Drag to reorder, or use the up and down arrow keys. Home and End move to the first and last positions. Press Escape to cancel a drag.</p>
    </div>
    <ol ref={listRef} aria-label="Proposal page order" className="space-y-2" onPointerMove={updateDrag} onPointerUp={finishDrag} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag}>
      {visiblePages.map((item, i) => {
        const unavailable = !contentEditable && item.kind === "text" && !item.body.trim();
        const lastIncluded = item.enabled && includedCount === 1;
        const Icon = pageIcons[item.kind];
        const dragging = preview?.id === item.id;
        return <li key={item.id} ref={element => { if (element) rows.current.set(item.id, element); else rows.current.delete(item.id); }}
          className={cn("group relative flex min-h-20 items-center gap-2 rounded-xl border px-2 py-2.5 transition-[background-color,border-color,box-shadow] motion-reduce:transition-none", dragging ? "z-10 border-primary bg-base-100 shadow-lg ring-2 ring-primary/15" : unavailable ? "border-dashed border-base-300 bg-base-200/30" : item.enabled ? "border-base-300 bg-base-100 shadow-xs hover:border-primary/30" : "border-base-300/70 bg-base-200/20")}>
          <button type="button" aria-label={`Reorder ${item.title}`} aria-describedby={instructionsId} disabled={disabled}
            className="flex min-h-11 w-5 shrink-0 touch-none items-center justify-center rounded-md text-base-content/35 outline-none hover:bg-base-200 hover:text-base-content focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-35 enabled:cursor-grab enabled:active:cursor-grabbing"
            onPointerDown={event => startDrag(event, item)}
            onKeyDown={event => keyboardMove(event, item.id, i)} title="Drag to reorder, or use arrow keys"><GripVertical size={16} aria-hidden="true" /></button>
          <span aria-hidden="true" className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold tabular-nums", item.enabled && !unavailable ? "bg-primary/8 text-primary" : "bg-base-200 text-base-content/40")}>{String(i + 1).padStart(2, "0")}</span>
          <div className="min-w-0 flex-1 py-1">
            {contentEditable ? <button type="button" disabled={disabled} aria-pressed={page?.id === item.id} className="w-full break-words text-left text-sm font-medium leading-snug underline-offset-4 hover:underline disabled:cursor-not-allowed" onClick={() => setEditingId(item.id)}>{item.title}</button>
              : <span className={cn("block break-words text-sm font-medium leading-snug", unavailable ? "text-base-content/45" : item.enabled ? "text-base-content" : "text-base-content/60")}>{item.title}</span>}
            <span className={cn("mt-1 flex items-center gap-1.5 text-[11px] leading-snug", unavailable ? "text-base-content/45" : "text-base-content/55")}><Icon size={12} className="shrink-0" aria-hidden="true" />{unavailable ? "Not configured yet" : lastIncluded ? "Keep one page included" : item.enabled ? "Included" : "Hidden"}</span>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-1">
            <input type="checkbox" className="du-toggle du-toggle-xs du-toggle-primary" aria-label={`Include ${item.title}`} disabled={disabled || unavailable || lastIncluded} checked={item.enabled} title={unavailable ? "This page hasn't been configured yet" : lastIncluded ? "Keep at least one page included" : item.enabled ? "Hide page" : "Include page"} onChange={event => togglePage(item.id, event.target.checked)} />
            <div className="flex items-center">
              <button type="button" aria-label={`Move ${item.title} up`} disabled={disabled || i === 0} className="flex h-7 w-6 items-center justify-center rounded-md text-base-content/45 hover:bg-base-200 hover:text-base-content focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-20" onClick={() => move(item.id, i - 1)}><ArrowUp size={13} aria-hidden="true" /></button>
              <button type="button" aria-label={`Move ${item.title} down`} disabled={disabled || i === draft.pages.length - 1} className="flex h-7 w-6 items-center justify-center rounded-md text-base-content/45 hover:bg-base-200 hover:text-base-content focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-20" onClick={() => move(item.id, i + 1)}><ArrowDown size={13} aria-hidden="true" /></button>
            </div>
          </div>
        </li>;
      })}
    </ol>
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{announcement}</p>
    {contentEditable && page && <div className="space-y-4 border-t border-base-300 pt-5" key={page.id}>
      <label className="block text-sm">Page title<input disabled={disabled} className="du-input du-input-sm mt-2 w-full" {...form.register(`pages.${index}.title`)} /></label>
      <label className="block text-sm">Page content<textarea disabled={disabled} className="du-textarea du-textarea-sm mt-2 min-h-48 w-full" placeholder="Tell the customer about your team, services or next steps. Data tokens work here too." {...form.register(`pages.${index}.body`)} /></label>
      {page.id.startsWith("page-") && <button type="button" disabled={disabled || (page.enabled && includedCount === 1)} className="du-btn du-btn-sm du-btn-ghost" onClick={removePage}><Trash2 size={14} />Remove page</button>}
    </div>}
  </div>;
}

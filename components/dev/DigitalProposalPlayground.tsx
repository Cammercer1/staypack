"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { useForm, useWatch } from "react-hook-form";
import { ArrowLeft, Check, Code2, Download, Eye, Monitor, Palette, RotateCcw, Save, SlidersHorizontal, Smartphone, Tablet, Upload, Files, Paperclip, Share2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { DigitalProposal } from "@/components/digital-proposals/DigitalProposal";
import { MultiPageProposal } from "@/components/digital-proposals/MultiPageProposal";
import { UnsavedListingGuard } from "@/components/listings/UnsavedListingGuard";
import { ProposalPagesEditor, ProposalDocumentsEditor, ProposalSharePanel, proposalFetch } from "@/components/digital-proposals/ProposalWorkspaceControls";
import type { ProposalWorkspace } from "@/lib/digital-proposals/workspace";
import { BRAND_PRESETS, brandOverridesSchema, contrastRatio, resetBrandOverride, resolveProposalBrand, type BrandField, type BrandOverrides } from "@/lib/digital-proposals/brand";
import { createProposalFixture, PROPOSAL_FIXTURES, type ProposalFixtureId } from "@/lib/digital-proposals/fixtures";
import { DEFAULT_PROPOSAL_DRAFT, proposalDraftSchema, refreshProposalDraftDefaults, validateProposalDraft, type ProposalDraft } from "@/lib/digital-proposals/template";
import { DATA_TOKENS, formatToken, resolveTokenText, type DataToken } from "@/lib/digital-proposals/tokens";
import type { ProposalData } from "@/lib/digital-proposals/data";

type SavedAppraisalPreview = { reportId: string; data: ProposalData; workspace?: ProposalWorkspace };

const STORAGE_KEY = "staypack:digital-proposal-studio:v1";
const subscribeHydration = () => () => {};
const CONTENT_FIELDS = { title: "Hero heading", introduction: "Introduction", recipientLine: "Customer line", comparisonTitle: "Comparison heading" } as const;
const COLOUR_FIELDS = { background: "Page background", surface: "Surface", text: "Text", muted: "Secondary text", primary: "Primary colour", primaryText: "Text on primary", chartLtr: "LTR chart", chartMarket: "Market STR chart", chartManaged: "Managed STR chart" } as const;
type ContentField = keyof typeof CONTENT_FIELDS;

function loadDraft(data: ProposalData, workspace?: ProposalWorkspace) {
  if (workspace?.draft) return { draft: refreshProposalDraftDefaults(workspace.draft), message: "Saved proposal draft" };
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return { draft: DEFAULT_PROPOSAL_DRAFT, message: "Local template draft" };
    const result = validateProposalDraft(JSON.parse(saved), data);
    return result.draft ? { draft: refreshProposalDraftDefaults(result.draft), message: "Local draft restored" } : { draft: DEFAULT_PROPOSAL_DRAFT, message: "Saved draft could not be read. The base template is open." };
  } catch { return { draft: DEFAULT_PROPOSAL_DRAFT, message: "Local storage unavailable. You can still export your template." }; }
}

export function DigitalProposalPlayground({ savedAppraisal }: { savedAppraisal?: SavedAppraisalPreview }) {
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  return hydrated ? <ProposalStudio savedAppraisal={savedAppraisal} /> : <div className="p-8" role="status">Opening digital template studio…</div>;
}

function ProposalStudio({ savedAppraisal }: { savedAppraisal?: SavedAppraisalPreview }) {
  const [initial] = useState(() => loadDraft(savedAppraisal?.data ?? createProposalFixture(), savedAppraisal?.workspace));
  const [workspace, setWorkspace] = useState(savedAppraisal?.workspace);
  const [saving, setSaving] = useState(false);
  const form = useForm<ProposalDraft>({ defaultValues: initial.draft });
  const watched = useWatch({ control: form.control }) as ProposalDraft;
  const structural = proposalDraftSchema.safeParse(watched);
  // Invalid draft values stay in the editor; the preview keeps valid inherited styles.
  const safeOverrides = brandOverridesSchema.safeParse(watched.brandOverrides);
  const draft = structural.success ? structural.data : { ...DEFAULT_PROPOSAL_DRAFT, ...watched, brandOverrides: safeOverrides.success ? safeOverrides.data : {} };
  const [fixtureId, setFixtureId] = useState<ProposalFixtureId | "saved">(savedAppraisal ? "saved" : "complete");
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "phone">("desktop");
  const [panel, setPanel] = useState<"brand" | "content" | "tokens" | "pages" | "documents" | "share">(savedAppraisal ? "pages" : "brand");
  const [mobileView, setMobileView] = useState<"preview" | "edit">("preview");
  const [contentField, setContentField] = useState<ContentField>("title");
  const [message, setMessage] = useState(initial.message);
  const textarea = useRef<HTMLTextAreaElement | null>(null);
  const upload = useRef<HTMLInputElement>(null);
  const usingSavedData = fixtureId === "saved" && Boolean(savedAppraisal);
  const data = fixtureId === "saved" && savedAppraisal ? savedAppraisal.data : createProposalFixture(fixtureId === "saved" ? "complete" : fixtureId);
  const resolved = resolveProposalBrand({ presetId: draft.presetId, template: draft.brandOverrides });
  const validation = validateProposalDraft(watched, data);
  const contrasts = [
    { name: "Body text", ratio: contrastRatio(resolved.values.text, resolved.values.background) },
    { name: "Secondary text", ratio: contrastRatio(resolved.values.muted, resolved.values.background) },
    { name: "Button text", ratio: contrastRatio(resolved.values.primaryText, resolved.values.primary) },
  ];
  const failingContrast = contrasts.filter(pair => pair.ratio < 4.5);
  const isDirty = form.formState.isDirty;

  function changeBrand(key: BrandField, value: string | number) {
    const overrides: BrandOverrides = { ...form.getValues("brandOverrides"), [key]: value };
    form.setValue("brandOverrides", overrides, { shouldDirty: true });
  }
  function resetField(key: BrandField) {
    form.setValue("brandOverrides", resetBrandOverride(form.getValues("brandOverrides"), key), { shouldDirty: true });
  }
  async function saveDraft(): Promise<number | null> {
    if (!validation.draft) return null;
    if (workspace && savedAppraisal) {
      setSaving(true);
      try {
        const result = await proposalFetch<{ draft: ProposalDraft; revision: number }>(`/api/str/appraisals/${savedAppraisal.reportId}/proposal?studio=1`, {
          method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft: validation.draft, revision: workspace.revision }),
        });
        setWorkspace(current => current && { ...current, ...result });
        form.reset(result.draft); setMessage("Saved to your account");
        return result.revision;
      } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save the draft."); return null; }
      finally { setSaving(false); }
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(validation.draft));
      form.reset(validation.draft); setMessage("Saved locally in this browser");
    } catch { setMessage("Local save failed. Export the template to keep your changes."); }
    return null;
  }
  function exportDraft() {
    if (!validation.draft) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(validation.draft, null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "staypack-digital-template.json"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setMessage("Template exported");
  }
  async function importDraft(file?: File) {
    if (!file) return;
    try {
      if (file.size > 100000) throw new Error("Choose a template JSON file under 100 KB.");
      const result = validateProposalDraft(JSON.parse(await file.text()), data);
      if (!result.draft) throw new Error(result.errors.join("; "));
      form.reset(refreshProposalDraftDefaults(result.draft), { keepDefaultValues: true }); setMessage("Template imported. Save the draft to keep it.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "This template could not be imported."); }
    if (upload.current) upload.current.value = "";
  }
  function insertToken(key: DataToken) {
    const field = `content.${contentField}` as const;
    const text = form.getValues(field);
    const start = textarea.current?.selectionStart ?? text.length;
    const end = textarea.current?.selectionEnd ?? text.length;
    const token = `{{${key}}}`;
    form.setValue(field, text.slice(0, start) + token + text.slice(end), { shouldDirty: true });
    requestAnimationFrame(() => { textarea.current?.focus(); textarea.current?.setSelectionRange(start + token.length, start + token.length); });
  }
  const contentRegistration = form.register(`content.${contentField}`);
  const tokenResult = resolveTokenText(draft.content[contentField], data);

  return <main data-theme="staypack-workspace" className="min-h-screen bg-base-200 text-base-content">
    <UnsavedListingGuard dirty={Boolean(workspace) && isDirty} description="Your proposal has unsaved changes. Save the draft to keep them in your account." />
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-base-300 bg-base-100 px-4 py-4 lg:px-6">
      <div className="flex items-center gap-3">
        <Link href="/short-term-rentals" aria-label="Back to short-term rentals" className="du-btn du-btn-sm du-btn-ghost du-btn-square"><ArrowLeft size={18} /></Link>
        <div className="min-w-0"><h1 className="font-display text-xl font-semibold">Digital template studio</h1><p className="mt-1 text-xs">Editorial base · v1 · {usingSavedData ? data.property.address : "sample property"}</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="du-btn du-btn-sm" type="button" onClick={() => upload.current?.click()}><Upload size={15} />Import</button>
        <button className="du-btn du-btn-sm" type="button" disabled={!validation.draft} onClick={exportDraft}><Download size={15} />Export</button>
        <button className="du-btn du-btn-sm du-btn-primary" type="button" disabled={!validation.draft || saving} onClick={() => void saveDraft()}><Save size={15} />{saving ? "Saving…" : "Save draft"}</button>
        {workspace && <button className="du-btn du-btn-sm" type="button" onClick={() => { setPanel("share"); setMobileView("edit"); }}><Share2 size={15} />Publish & share</button>}
        <input ref={upload} className="hidden" aria-label="Import template JSON" type="file" accept="application/json,.json" onChange={event => void importDraft(event.target.files?.[0])} />
      </div>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 bg-base-100 px-5 py-2 text-xs">
      <p role="status" className="min-w-0 break-words">{isDirty ? "Unsaved changes · " : ""}{message}</p>
      <span>{workspace ? "Editing proposal draft" : "Preview only · no appraisal updated"}</span>
    </div>
    <div className="flex gap-2 px-4 pt-4 lg:hidden" role="group" aria-label="Studio view">
      <button type="button" aria-pressed={mobileView === "preview"} className={cn("du-btn du-btn-sm min-h-11 flex-1", mobileView === "preview" && "du-btn-primary")} onClick={() => setMobileView("preview")}><Eye size={16} />Preview</button>
      <button type="button" aria-pressed={mobileView === "edit"} className={cn("du-btn du-btn-sm min-h-11 flex-1", mobileView === "edit" && "du-btn-primary")} onClick={() => setMobileView("edit")}><SlidersHorizontal size={16} />Edit template</button>
    </div>
    <div className="grid min-w-0 lg:grid-cols-[300px_minmax(0,1fr)]">
      <aside aria-label="Template settings" className={cn("min-w-0 border-base-300 bg-base-100 p-5 lg:block lg:border-r", mobileView === "edit" ? "block" : "hidden")}>
        <fieldset disabled={saving} className="min-w-0">
        <label className="block text-sm font-medium" htmlFor="proposal-fixture">Preview data</label>
        <select id="proposal-fixture" className="du-select du-select-sm mt-2 w-full" value={fixtureId} onChange={event => setFixtureId(event.target.value as ProposalFixtureId | "saved")}>
          {savedAppraisal && <option value="saved">Saved appraisal · {savedAppraisal.data.property.address}</option>}
          <optgroup label="Sample datasets">{Object.entries(PROPOSAL_FIXTURES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</optgroup>
        </select>
        {usingSavedData && savedAppraisal && <Link href={`/short-term-rentals/appraisals/${savedAppraisal.reportId}`} className="mt-3 inline-block text-xs underline underline-offset-4">Open appraisal</Link>}
        <div role="group" aria-label="Proposal tools" className="mt-5 grid grid-cols-2 gap-2">
          {([{ id: "pages", label: "Pages", Icon: Files }, { id: "documents", label: "Documents", Icon: Paperclip }] as const).map(({ id, label, Icon }) => <button type="button" key={id} className={cn("du-btn du-btn-sm", panel === id && "du-btn-primary")} onClick={() => setPanel(id)} aria-pressed={panel === id}><Icon size={14} />{label}</button>)}
        </div>
        <div role="group" aria-label="Editor section" className="my-5 flex gap-1 border-y border-base-300 py-3">
          {([{ id: "brand", label: "Brand", Icon: Palette }, { id: "content", label: "Content", Icon: SlidersHorizontal }, { id: "tokens", label: "Tokens", Icon: Code2 }] as const).map(({ id, label, Icon }) => <button type="button" key={id} className={cn("du-btn du-btn-sm flex-1 px-2", panel === id ? "du-btn-primary" : "du-btn-ghost")} aria-pressed={panel === id} onClick={() => setPanel(id)}><Icon size={14} />{label}</button>)}
        </div>
        {panel === "pages" && <ProposalPagesEditor form={form} draft={draft} />}
        {panel === "documents" && <ProposalDocumentsEditor form={form} draft={draft} reportId={savedAppraisal?.reportId} workspace={workspace} onWorkspaceChange={value => setWorkspace(current => current && { ...current, ...value })} />}
        {panel === "share" && workspace && savedAppraisal && <ProposalSharePanel reportId={savedAppraisal.reportId} workspace={workspace} onSave={saveDraft} valid={Boolean(validation.draft) && usingSavedData} onWorkspaceChange={value => setWorkspace(current => current && { ...current, ...value })} />}
        {panel === "brand" && <div className="space-y-5">
          <div><label className="mb-2 block text-sm font-medium" htmlFor="proposal-preset">Brand preset</label><select id="proposal-preset" className="du-select du-select-sm w-full" {...form.register("presetId")}>{Object.entries(BRAND_PRESETS).map(([id, preset]) => <option key={id} value={id}>{preset.name}</option>)}</select></div>
          <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-semibold">Brand overrides</h2><button type="button" className="du-btn du-btn-sm du-btn-ghost" disabled={!Object.keys(draft.brandOverrides).length} onClick={() => form.setValue("brandOverrides", {}, { shouldDirty: true })}>Reset all</button></div>
          <div className="space-y-3">{Object.entries(COLOUR_FIELDS).map(([key, label]) => <div key={key} className="flex items-center gap-2">
            <input id={`brand-${key}`} type="color" aria-label={label} className="h-9 w-10 cursor-pointer rounded border border-base-300 bg-transparent p-1" value={resolved.values[key as keyof typeof COLOUR_FIELDS]} onChange={event => changeBrand(key as BrandField, event.target.value)} />
            <label className="min-w-0 flex-1 text-sm" htmlFor={`brand-${key}`}>{label}<span className="block text-xs text-base-content/70">{resolved.sources[key as BrandField] === "template" ? "Custom" : "Inherited"} · {resolved.values[key as keyof typeof COLOUR_FIELDS]}</span></label>
            <button type="button" className="du-btn du-btn-sm du-btn-ghost du-btn-square" aria-label={`Reset ${label.toLowerCase()}`} disabled={draft.brandOverrides[key as BrandField] === undefined} onClick={() => resetField(key as BrandField)}><RotateCcw size={14} /></button>
          </div>)}</div>
          {(["headingFont", "bodyFont"] as const).map(key => <div key={key}>
            <div className="mb-2 flex items-center justify-between"><label htmlFor={key} className="text-sm font-medium">{key === "headingFont" ? "Heading font" : "Body font"}</label><button type="button" aria-label={`Reset ${key === "headingFont" ? "heading" : "body"} font`} className="du-btn du-btn-sm du-btn-ghost du-btn-square" disabled={draft.brandOverrides[key] === undefined} onClick={() => resetField(key)}><RotateCcw size={14} /></button></div>
            <select id={key} aria-label={key === "headingFont" ? "Heading font" : "Body font"} className="du-select du-select-sm w-full" value={resolved.values[key]} onChange={event => changeBrand(key, event.target.value)}>
              <option value="Fraunces, Georgia, serif">Fraunces</option><option value="DM Sans, Arial, sans-serif">DM Sans</option><option value="Georgia, serif">Georgia</option>
              {!["Fraunces, Georgia, serif", "DM Sans, Arial, sans-serif", "Georgia, serif"].includes(resolved.values[key]) && <option value={resolved.values[key]}>{resolved.values[key]}</option>}
            </select>
          </div>)}
          <div><div className="mb-2 flex items-center justify-between"><label htmlFor="proposal-radius" className="text-sm font-medium">Corner radius</label><button type="button" className="du-btn du-btn-sm du-btn-ghost" disabled={draft.brandOverrides.radius === undefined} onClick={() => resetField("radius")}>Reset</button></div>
            <div className="flex items-center gap-3"><input id="proposal-radius" type="range" min={0} max={32} value={resolved.values.radius} onChange={event => changeBrand("radius", Number(event.target.value))} className="du-range du-range-sm flex-1" /><span className="text-xs tabular-nums">{resolved.values.radius}px</span></div>
          </div>
          <details className="border-t border-base-300 pt-4 text-xs"><summary className="cursor-pointer font-medium">Text contrast · {failingContrast.length ? `${failingContrast.length} to review` : "passes AA"}</summary><ul className="mt-2 space-y-2">{contrasts.map(pair => <li key={pair.name}>{pair.name}: {pair.ratio.toFixed(1)}:1 {pair.ratio >= 4.5 ? "· AA" : "· below 4.5:1"}</li>)}</ul></details>
        </div>}
        {panel === "content" && <div className="space-y-5">
          <div><label htmlFor="content-field" className="mb-2 block text-sm font-medium">Text to edit</label><select id="content-field" className="du-select du-select-sm w-full" value={contentField} onChange={event => setContentField(event.target.value as ContentField)}>{Object.entries(CONTENT_FIELDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></div>
          <div><label htmlFor="proposal-copy" className="mb-2 block text-sm font-medium">{CONTENT_FIELDS[contentField]}</label><textarea key={contentField} id="proposal-copy" className="du-textarea du-textarea-sm min-h-36 w-full" {...contentRegistration} ref={element => { contentRegistration.ref(element); textarea.current = element; }} /></div>
          <label className="block text-sm" htmlFor="insert-token">Insert data token</label><select id="insert-token" className="du-select du-select-sm w-full" value="" onChange={event => { if (event.target.value) insertToken(event.target.value as DataToken); }}><option value="">Choose a field…</option>{Object.entries(DATA_TOKENS).map(([key, token]) => <option key={key} value={key}>{token.label}</option>)}</select>
          {tokenResult.missing.length > 0 && <p className="text-xs">This line is hidden when its data is missing.</p>}
          <div><label htmlFor="hero-layout" className="mb-2 block text-sm font-medium">Hero layout</label><select id="hero-layout" className="du-select du-select-sm w-full" {...form.register("heroLayout")}><option value="overlay">Image with text overlay</option><option value="split">Split editorial</option><option value="panorama">Panoramic image</option></select></div>
          <div><label htmlFor="comparison-mode" className="mb-2 block text-sm font-medium">Starting comparison</label><select id="comparison-mode" className="du-select du-select-sm w-full" {...form.register("initialComparisonMode")}><option value="annual">Annual revenue</option><option value="monthly">Monthly average</option><option value="yield">Gross yield</option></select></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register("motion")} />Animate the comparison</label>
        </div>}
        {panel === "tokens" && <div><h2 className="mb-4 text-sm font-semibold">Available data tokens</h2><ul className="space-y-4">{Object.entries(DATA_TOKENS).map(([key, token]) => <li key={key} className="border-b border-base-300 pb-3"><p className="text-sm font-medium">{token.label}</p><code className="mt-1 block break-all text-xs">{`{{${key}}}`}</code><p className="mt-1 text-xs">{formatToken(key as DataToken, data) ?? "Not supplied"}</p></li>)}</ul></div>}
        {validation.errors.length > 0 && <div role="alert" className="du-alert du-alert-error mt-5 block text-xs"><p className="font-semibold">Fix before saving</p><ul className="mt-2 space-y-1">{validation.errors.map(error => <li className="break-words" key={error}>{error}</li>)}</ul></div>}
        </fieldset>
      </aside>
      <section aria-label="Live preview" className={cn("min-w-0 p-3 lg:block lg:p-6", mobileView === "preview" ? "block" : "hidden")}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs"><Check size={14} />{usingSavedData ? "Live preview · saved appraisal figures" : "Live preview · illustrative figures"}</p>
          <div role="group" aria-label="Preview width" className="flex gap-1">{([{ id: "desktop", label: "Desktop", Icon: Monitor }, { id: "tablet", label: "Tablet", Icon: Tablet }, { id: "phone", label: "Phone", Icon: Smartphone }] as const).map(({ id, label, Icon }) => <button type="button" key={id} aria-label={`${label} preview`} aria-pressed={viewport === id} className={cn("du-btn du-btn-sm", viewport === id ? "du-btn-primary" : "du-btn-ghost")} onClick={() => setViewport(id)}><Icon size={16} /><span className="hidden sm:inline">{label}</span></button>)}</div>
        </div>
        <div className={cn("mx-auto overflow-hidden border border-base-300 shadow-sm", viewport === "phone" ? "max-w-[390px]" : viewport === "tablet" ? "max-w-[768px]" : "max-w-[1440px]")}>
          {savedAppraisal ? <MultiPageProposal data={data} brand={resolved.values} draft={draft} previewPdfDownload attachments={(workspace?.attachments ?? []).filter(item => draft.attachmentIds.includes(item.id)).map(item => ({ ...item, href: `/api/str/appraisals/${savedAppraisal.reportId}/proposal/attachments/${item.id}` }))} /> : <DigitalProposal data={data} brand={resolved.values} draft={draft} />}
        </div>
        <p className="mt-4 text-center text-xs">{usingSavedData ? "Using saved property details, photography and estimates. Reload to pick up appraisal changes." : "Sample address, photography and figures for template design."}</p>
      </section>
    </div>
  </main>;
}

"use client";

import { useAppraisalRoutes } from "@/components/appraisals/AppraisalRoutes";
import { useEffect, useState } from "react";
import { AlertCircle, Eye, Loader2, MousePointer2, RefreshCw } from "lucide-react";
import { activityLabels, type ActivitySummary } from "@/lib/digital-proposals/activity";
import { proposalFetch } from "./proposalFetch";

export function ProposalActivity({ reportId, refreshKey }: { reportId: string; refreshKey?: string }) {
  const paths = useAppraisalRoutes(reportId);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void proposalFetch<ActivitySummary>(`${paths.api}/proposal/activity`).then(value => {
      if (!cancelled) { setSummary(value); setError(""); }
    }).catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : "Unable to load proposal activity."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [paths.api, refreshKey, reload]);
  const interactions = summary?.items.filter(item => item.kind !== "open") ?? [];
  return <section aria-label="Proposal activity" className="du-card du-card-border min-w-0 bg-base-100">
    <div className="du-card-body min-w-0 gap-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2"><div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-base-200"><Eye size={20} aria-hidden="true" /></span><div><h2 className="du-card-title text-base">Proposal activity</h2></div></div><button type="button" disabled={loading} aria-label="Refresh activity" title="Refresh activity" className="du-btn du-btn-sm du-btn-square du-btn-ghost min-h-11 min-w-11" onClick={() => { setLoading(true); setReload(value => value + 1); }}>{loading ? <Loader2 size={17} className="motion-safe:animate-spin" aria-hidden="true" /> : <RefreshCw size={17} aria-hidden="true" />}</button></div>
      {error && <div role="alert" className="du-alert du-alert-error flex items-start gap-2 text-left text-xs"><AlertCircle size={17} className="shrink-0" aria-hidden="true" /><span>{error} Use refresh to try again.</span></div>}
      {loading && !summary && <div role="status" className="space-y-3"><span className="sr-only">Loading proposal activity…</span><div className="du-skeleton h-8 w-16 motion-reduce:animate-none" /><div className="du-skeleton h-4 w-40 max-w-full motion-reduce:animate-none" /></div>}
      {summary && <>
        <dl className="grid grid-cols-[minmax(0,0.65fr)_minmax(0,1fr)] gap-4 rounded-xl bg-base-200/40 p-4"><div><dt className="text-xs text-base-content/65">Proposal opens</dt><dd className="mt-2 text-3xl font-medium tabular-nums">{summary.opens}</dd></div><div className="border-l border-base-300 pl-4"><dt className="text-xs text-base-content/65">Last opened</dt><dd className="mt-2 text-sm leading-relaxed">{summary.lastOpened ? new Date(summary.lastOpened).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short", timeZone: "Australia/Sydney" }) : "Not yet opened"}</dd></div></dl>
        {summary.opens === 0 && interactions.length === 0 ? <div className="flex items-start gap-3"><MousePointer2 size={18} className="mt-0.5 shrink-0 text-base-content/45" aria-hidden="true" /><p className="text-xs leading-relaxed text-base-content/65">Once you share the link, opens and interactions will appear here.</p></div> : interactions.length > 0 && <details open className="min-w-0"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">Pages viewed and interactions <span className="ml-1 text-base-content/55">({interactions.reduce((count, item) => count + item.count, 0)})</span></summary><ul className="du-list max-h-80 min-w-0 overflow-y-auto">{interactions.map(item => <li key={`${item.versionId}:${item.kind}:${item.target}`} className="du-list-row min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-3 rounded-none px-0 py-3"><div className="min-w-0"><p className="break-words text-sm [overflow-wrap:anywhere]">{item.label}</p>{item.label !== activityLabels[item.kind] && <p className="mt-1 text-xs text-base-content/60">{activityLabels[item.kind]}</p>}</div><span className="du-badge du-badge-sm du-badge-ghost tabular-nums">{item.count}</span></li>)}</ul></details>}
      </>}
      <p className="border-t border-base-300 pt-4 text-xs leading-relaxed text-base-content/55">Activity includes anyone using the link, including forwards. Repeated actions in the same visit count once.</p>
    </div>
  </section>;
}

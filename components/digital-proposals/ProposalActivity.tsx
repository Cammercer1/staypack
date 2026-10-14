"use client";
import { useAppraisalRoutes } from "@/components/appraisals/AppraisalRoutes";
import { useEffect, useState } from "react";
import { activityLabels, type ActivitySummary } from "@/lib/digital-proposals/activity";
import { proposalFetch } from "./ProposalWorkspaceControls";
export function ProposalActivity({ reportId, refreshKey }: { reportId: string; refreshKey?: string }) {
  const paths = useAppraisalRoutes(reportId);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void proposalFetch<ActivitySummary>(`${paths.api}/proposal/activity`).then(value => { if (!cancelled) { setSummary(value); setError(""); } }).catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [reportId, refreshKey, reload]);
  return <section className="rounded-xl border border-base-300 bg-base-100 p-5 sm:p-7">
    <div className="flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">Proposal activity</h2><button type="button" className="du-btn du-btn-sm du-btn-ghost min-h-11" onClick={() => setReload(value => value + 1)}>Refresh activity</button></div>
    {error && <p role="status" className="mt-3 text-sm">{error}</p>}
    {summary && <>
      <dl className="mt-4 grid grid-cols-2 gap-5"><div><dt className="text-sm">Opens</dt><dd className="mt-1 text-3xl tabular-nums">{summary.opens}</dd></div><div><dt className="text-sm">Last opened</dt><dd className="mt-2 text-sm">{summary.lastOpened ? new Date(summary.lastOpened).toLocaleString("en-AU") : "Not yet opened"}</dd></div></dl>
      <p className="mt-4 text-xs text-base-content/60">Activity follows the share link, including forwards. Repeated actions within a visit count once.</p>
      {summary.items.length > 0 && <ul className="mt-5 divide-y divide-base-300">{summary.items.filter(item => item.kind !== "open").map(item => <li key={`${item.versionId}:${item.kind}:${item.target}`} className="flex items-center justify-between gap-4 py-3 text-sm"><span className="min-w-0 break-words">{item.label}<span className="mt-1 block text-xs text-base-content/60">{activityLabels[item.kind]}</span></span><span className="tabular-nums">{item.count}</span></li>)}</ul>}
    </>}
  </section>;
}

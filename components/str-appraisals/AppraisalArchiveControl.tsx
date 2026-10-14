"use client";
import { useAppraisalRoutes } from "@/components/appraisals/AppraisalRoutes";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive } from "lucide-react";
import { readPrivateResponse } from "./useRemoteOptions";

export function AppraisalArchiveControl({ reportId, archived = false }: { reportId: string; archived?: boolean }) {
  const paths = useAppraisalRoutes(reportId);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function changeArchive() {
    setBusy(true); setError(null);
    try {
      await readPrivateResponse(await fetch(`${paths.api}`, { method: archived ? "POST" : "DELETE" }));
      router.push(archived ? paths.editor : paths.dashboard); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update appraisal."); }
    finally { setBusy(false); }
  }

  return <div data-theme="staypack-workspace">
    <div className="flex justify-end"><button type="button" className="du-btn du-btn-sm du-btn-ghost min-h-11" disabled={busy} onClick={() => archived ? void changeArchive() : setConfirmArchive(true)}><Archive className="size-4" aria-hidden="true" />{archived ? "Restore appraisal" : "Archive"}</button></div>
    {confirmArchive && <div className="mt-3 rounded-xl border border-base-300 bg-base-100 p-5"><p className="text-sm">Archive this appraisal? It will leave the active list and its public report page will be unavailable. The property and its other documents will remain.</p><div className="mt-3 flex gap-3"><button type="button" className="du-btn du-btn-sm min-h-11" disabled={busy} onClick={() => void changeArchive()}>{busy ? "Archiving…" : "Confirm archive"}</button><button type="button" className="du-btn du-btn-sm du-btn-ghost min-h-11" disabled={busy} onClick={() => setConfirmArchive(false)}>Cancel</button></div></div>}
    {error && <p className="mt-4 text-sm text-error" role="alert">{error}</p>}
  </div>;
}

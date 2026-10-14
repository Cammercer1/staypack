"use client";

import { useState } from "react";

export function BillingAction({ planId, children }: { planId?: string; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function open() {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/billing/${planId ? "checkout" : "portal"}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planId ? { planId } : {}),
      });
      const data = await response.json();
      if (!response.ok || typeof data.url !== "string") throw new Error(data.error ?? "Unable to open billing.");
      window.location.assign(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to open billing.");
      setBusy(false);
    }
  }
  return <div className="space-y-2">
    <button type="button" className="du-btn du-btn-primary" onClick={open} disabled={busy}>{busy ? "Opening…" : children}</button>
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
  </div>;
}

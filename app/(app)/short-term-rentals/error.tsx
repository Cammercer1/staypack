"use client";
import Link from "next/link";
export default function StrWorkspaceError({ reset }: { reset: () => void }) {
  return <div className="space-y-5"><h1 className="font-display text-3xl">Unable to load Short-Term Rentals</h1><p>Your saved appraisals have not been changed. Try again to reconnect.</p><div className="flex flex-wrap gap-3"><button onClick={reset} className="du-btn du-btn-sm min-h-11">Try again</button><Link href="/appraisals" className="du-btn du-btn-sm du-btn-ghost min-h-11">All appraisals</Link></div></div>;
}

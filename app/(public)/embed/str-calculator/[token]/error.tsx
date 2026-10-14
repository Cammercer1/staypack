"use client";
export default function EmbedError({ reset }: { reset: () => void }) {
  return <main data-theme="staypack-workspace" className="min-h-dvh space-y-4 bg-base-100 p-8 text-base-content"><h1 className="text-xl font-semibold">Calculator temporarily unavailable</h1><p className="text-sm leading-6">Please try again, or contact the agency directly.</p><button onClick={reset} className="du-btn du-btn-primary">Try again</button></main>;
}

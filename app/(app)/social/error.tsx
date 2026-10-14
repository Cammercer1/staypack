"use client";
export default function SocialError({ reset }: { reset: () => void }) {
  return <div data-theme="staypack-workspace" className="space-y-4 text-base-content"><h1 className="font-display text-3xl">Social media</h1><p role="alert">Social media could not be loaded. Your saved designs have been kept.</p><button className="du-btn du-btn-sm min-h-11" onClick={reset}>Try again</button></div>;
}

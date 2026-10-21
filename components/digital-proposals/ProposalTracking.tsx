"use client";
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode, type RefObject } from "react";
import type { ProposalEvent } from "@/lib/digital-proposals/activity";
type Track = (kind: ProposalEvent["kind"], target: string) => void;
const noTracking: Track = () => {};
const Tracking = createContext<Track>(noTracking);
export const useProposalTracking = () => useContext(Tracking);
/** Present only on public links. No fingerprinting, contact data or cross-site identifiers. */
export function ProposalTracking({ token, versionId, children }: { token: string; versionId: string; children: ReactNode }) {
  const sent = useRef(new Set<string>());
  const session = useRef<string | null>(null);
  const lastSeen = useRef(0);
  const track = useCallback<Track>((kind, target) => {
    if (typeof document === "undefined" || document.visibilityState !== "visible" || navigator.webdriver) return;
    const previousSession = session.current;
    const now = Date.now();
    try {
      const stored = JSON.parse(sessionStorage.getItem(`proposal:${token}`) ?? "null");
      const current = typeof stored?.id === "string" && typeof stored?.seen === "number" && now - stored.seen < 30 * 60_000 ? stored.id : crypto.randomUUID();
      session.current = current;
      sessionStorage.setItem(`proposal:${token}`, JSON.stringify({ id: current, seen: now }));
    } catch { if (!session.current || now - lastSeen.current >= 30 * 60_000) session.current = crypto.randomUUID(); }
    lastSeen.current = now;
    if (session.current !== previousSession) sent.current.clear();
    const key = `${token}:${versionId}:${kind}:${target}`;
    if (sent.current.has(key)) return;
    const event: ProposalEvent = { id: crypto.randomUUID(), session: session.current!, versionId, kind, target };
    sent.current.add(key);
    void fetch(`/api/proposals/${token}/events`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(event), keepalive: true }).then(response => { if (!response.ok) sent.current.delete(key); }).catch(() => sent.current.delete(key));
  }, [token, versionId]);
  return <Tracking.Provider value={track}>{children}</Tracking.Provider>;
}

/** Follow the displayed page, not the initial URL or any assets warmed in the background. */
export function useProposalPageTracking(pageId: string | undefined, root: RefObject<HTMLDivElement | null>) {
  const track = useProposalTracking();
  useEffect(() => {
    if (!pageId || track === noTracking) return;
    const record = () => { track("open", "proposal"); track("page", pageId); };
    const timeout = window.setTimeout(record, 700);
    document.addEventListener("visibilitychange", record);
    return () => { clearTimeout(timeout); document.removeEventListener("visibilitychange", record); };
  }, [track, pageId]);
  useEffect(() => {
    if (!pageId || track === noTracking || !root.current || typeof IntersectionObserver === "undefined") return;
    const container = root.current;
    const observed = new Set<Element>();
    let active = true;
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (active && entry.isIntersecting && !entry.target.closest('[data-proposal-page][aria-hidden="true"]')) track("comparable", (entry.target as HTMLElement).dataset.proposalComparable!);
    }), { threshold: 0.6 });
    const observeVisiblePage = () => container.querySelectorAll("[data-proposal-comparable]").forEach(element => {
      if (!element.closest('[data-proposal-page][aria-hidden="true"]') && !observed.has(element)) { observed.add(element); observer.observe(element); }
    });
    observeVisiblePage();
    // A split section may mount after the page-selection effect has already run.
    const mutations = new MutationObserver(observeVisiblePage);
    mutations.observe(container, { childList: true, subtree: true });
    return () => { active = false; observer.disconnect(); mutations.disconnect(); };
  }, [track, pageId, root]);
}

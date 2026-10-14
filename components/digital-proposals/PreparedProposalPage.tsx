"use client";

import { Component, createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./MultiPageProposal.module.css";

// Prepared charts render at their real width before the page is revealed.
const PreparedPage = createContext(false);
const PageVisible = createContext(true);
export const usePreparedProposalPage = () => useContext(PreparedPage);
export const useProposalPageVisible = () => useContext(PageVisible);

export function PreparedProposalPage({ id, active, motion, className, onReady, onError, children }: {
  id: string; active: boolean; motion: boolean; className?: string;
  onReady: (id: string) => void; onError: (id: string) => void; children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    let disposed = false, finished = false, frame = 0, pendingImages = 0, fontsReady = !document.fonts;
    const images = new Set<HTMLImageElement>();
    const cleanups: (() => void)[] = [];
    const check = () => {
      if (disposed || finished) return;
      element.querySelectorAll<HTMLImageElement>('img:not([loading="lazy"])').forEach(image => {
        if (images.has(image)) return;
        images.add(image); pendingImages++;
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true; clearTimeout(timer);
          image.removeEventListener("load", loaded); image.removeEventListener("error", done);
          pendingImages--; check();
        };
        const loaded = () => { if (image.decode) void image.decode().catch(() => {}).then(done); else done(); };
        // Decorative imagery must never block navigation indefinitely.
        const timer = setTimeout(done, 1800);
        cleanups.push(() => { clearTimeout(timer); image.removeEventListener("load", loaded); image.removeEventListener("error", done); });
        if (image.complete) loaded();
        else { image.addEventListener("load", loaded, { once: true }); image.addEventListener("error", done, { once: true }); }
      });
      cancelAnimationFrame(frame);
      if (pendingImages || !fontsReady || element.querySelector('[data-proposal-loading], [data-proposal-chart="pending"]')) return;
      // Wait for layout and chart SVG mutations to settle before revealing the frame.
      frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => {
          if (disposed || finished) return;
          finished = true; onReady(id);
        });
      });
    };
    const fontTimer = setTimeout(() => { fontsReady = true; check(); }, 1500);
    void document.fonts?.ready.then(() => { fontsReady = true; clearTimeout(fontTimer); check(); });
    const observer = new MutationObserver(check);
    observer.observe(element, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-proposal-chart", "src"] });
    check();
    return () => { disposed = true; observer.disconnect(); cancelAnimationFrame(frame); clearTimeout(fontTimer); cleanups.forEach(cleanup => cleanup()); };
  }, [id, onReady]);
  return <div ref={root} data-proposal-page={id} data-current={active || undefined} aria-hidden={active ? undefined : true} inert={!active}
    className={cn(styles.page, active ? styles.current : styles.prepared, active && motion && styles.reveal, className)}>
    <PreparedPage.Provider value={true}><PageVisible.Provider value={active}><PreparationBoundary onError={() => onError(id)}>{children}</PreparationBoundary></PageVisible.Provider></PreparedPage.Provider>
  </div>;
}

class PreparationBoundary extends Component<{ onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? <p data-proposal-loading className="p-6" role="alert">This page could not be loaded. Please reload the proposal.</p> : this.props.children; }
}

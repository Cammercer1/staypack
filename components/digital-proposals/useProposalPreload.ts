"use client";

import { useCallback, useEffect, useRef } from "react";
import { comparablesByEstimate } from "@/lib/digital-proposals/presentation";
import type { ProposalData } from "@/lib/digital-proposals/data";
import type { ProposalPage } from "@/lib/digital-proposals/template";
import { preloadProposalPage } from "./proposalPageModules";

type Task = { key: string; run: (urgent: boolean) => Promise<unknown>; urgent: boolean };

/** At most two background jobs; interaction promotes queued work without duplicating it. */
function preloadQueue() {
  const known = new Set<string>();
  const pending: Task[] = [];
  let active = 0, disposed = false;
  const pump = () => {
    while (!disposed && active < 2 && pending.length) {
      const task = pending.shift()!;
      active++;
      void task.run(task.urgent).catch(() => known.delete(task.key)).finally(() => { active--; pump(); });
    }
  };
  return {
    add(tasks: Omit<Task, "urgent">[], urgent = false) {
      if (disposed) return;
      const additions: Task[] = [];
      for (const task of tasks) {
        const queued = pending.findIndex(item => item.key === task.key);
        if (urgent && queued >= 0) {
          additions.push({ ...pending.splice(queued, 1)[0], urgent });
        } else if (!known.has(task.key)) {
          known.add(task.key); additions.push({ ...task, urgent });
        }
      }
      if (urgent) pending.unshift(...additions); else pending.push(...additions);
      pump();
    },
    dispose() { disposed = true; pending.length = 0; },
  };
}

function warmImage(url: string, urgent: boolean) {
  return new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.fetchPriority = urgent ? "high" : "low";
    const finish = (failed = false) => {
      clearTimeout(timeout); image.onload = null; image.onerror = null;
      if (failed) reject(new Error("Image unavailable")); else resolve();
    };
    const timeout = setTimeout(() => finish(true), 8000);
    image.onload = () => {
      if (image.decode) void image.decode().catch(() => {}).finally(() => finish());
      else finish();
    };
    image.onerror = () => finish(true);
    image.src = url;
  });
}

/** Give the cover a paint, without making the next page wait for a slow photo. */
function afterCoverPaint(run: () => void) {
  let secondFrame = 0;
  const firstFrame = requestAnimationFrame(() => { secondFrame = requestAnimationFrame(run); });
  return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame); };
}

/** Separate code and image queues so slow photos cannot block page preparation. */
export function useProposalPreload(data: ProposalData, pages: ProposalPage[], enabled: boolean, activePageId = pages.find(page => page.enabled)?.id, onPrepared?: (id: string) => void, onError?: (id: string) => void) {
  const queue = useRef<{ modules: ReturnType<typeof preloadQueue>; images: ReturnType<typeof preloadQueue> } | null>(null);
  const callbacks = useRef({ onPrepared, onError });
  useEffect(() => { callbacks.current = { onPrepared, onError }; }, [onPrepared, onError]);
  const tasksForPage = useCallback((page: ProposalPage) => {
    const urls = [
      ...(page.kind === "hero" ? [data.property.heroImageUrl] : []),
      ...(page.kind === "evidence" ? comparablesByEstimate(data).map(item => item.imageUrl) : []),
      ...(page.kind === "next_steps" ? data.agents.map(agent => agent.photoUrl) : []),
      ...(page.kind === "service" ? [page.service?.imageUrl ?? ""] : []),
    ].filter(Boolean);
    return {
      modules: [{ key: `module:${page.id}`, run: async () => {
        const owner = queue.current;
        try { await preloadProposalPage(page.kind); if (queue.current === owner) callbacks.current.onPrepared?.(page.id); }
        catch (error) { if (queue.current === owner) callbacks.current.onError?.(page.id); throw error; }
      } }],
      images: urls.map(url => ({ key: url, run: (urgent: boolean) => warmImage(url, urgent) })),
    };
  }, [data]);
  useEffect(() => {
    if (!enabled) return;
    const current = { modules: preloadQueue(), images: preloadQueue() }; queue.current = current;
    return () => { current.modules.dispose(); current.images.dispose(); queue.current = null; };
  }, [enabled, tasksForPage, pages]);
  const warm = useCallback((pageId: string) => {
    const page = pages.find(page => page.enabled && page.id === pageId);
    if (enabled && page) {
      const tasks = tasksForPage(page);
      queue.current?.modules.add(tasks.modules, true); queue.current?.images.add(tasks.images, true);
    }
  }, [enabled, pages, tasksForPage]);
  useEffect(() => {
    if (!enabled) return;
    return afterCoverPaint(() => {
      const included = pages.filter(page => page.enabled);
      const index = included.findIndex(page => page.id === activePageId);
      const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
      // Keep data-saving connections focused on the next page; clicks still warm any destination.
      const constrained = connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? "");
      const upcoming = [...included.slice(index + 1), ...included.slice(0, Math.max(0, index))];
      for (const page of constrained ? upcoming.slice(0, 1) : upcoming) {
        const tasks = tasksForPage(page);
        queue.current?.modules.add(tasks.modules); queue.current?.images.add(tasks.images);
      }
    });
  }, [activePageId, data, enabled, pages, tasksForPage]);
  return warm;
}

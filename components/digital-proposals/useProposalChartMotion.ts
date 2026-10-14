"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePreparedProposalPage } from "./PreparedProposalPage";

const subscribeMotion = (notify: () => void) => {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};

export function useProposalChartMotion(motion: boolean, ready = true) {
  const ref = useRef<HTMLDivElement>(null);
  const prepared = usePreparedProposalPage();
  const [visible, setVisible] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => true);
  useEffect(() => {
    if (!ready || prepared) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: "80px" });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ready, prepared]);
  return { ref, visible: ready && (prepared || visible), animate: motion && !reducedMotion };
}

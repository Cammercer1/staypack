"use client";

import {
  createElement,
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type ElementType,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";
import type { ReportCopyFieldPath } from "@/lib/reports/editable/reportCopyPaths";
import { useReportEditableContext } from "@/components/reports/inline/ReportEditableContext";

type Props = {
  as?: ElementType;
  path: ReportCopyFieldPath;
  className?: string;
  style?: CSSProperties;
  recommendedMaxLength?: number;
  children: ReactNode;
};

function textFromChildren(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  return "";
}

export function ReportEditable({
  as: Component = "span",
  path,
  className,
  style,
  recommendedMaxLength,
  children,
}: Props) {
  const { editable, setField, onFieldFocus } = useReportEditableContext();
  const ref = useRef<HTMLElement>(null);
  const isFocusedRef = useRef(false);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const value = textFromChildren(children);
  const overRecommendedRef = useRef(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || isFocusedRef.current) {
      return;
    }
    if (el.textContent !== value) {
      el.textContent = value;
    }
    const over =
      recommendedMaxLength != null &&
      (el.textContent?.length ?? 0) > recommendedMaxLength;
    if (over !== overRecommendedRef.current) {
      overRecommendedRef.current = over;
      el.classList.toggle("ring-1", over);
      el.classList.toggle("ring-amber-500/70", over);
      el.classList.toggle("hover:ring-amber-500/70", over);
      el.classList.toggle("focus-visible:ring-amber-500/70", over);
      if (over && recommendedMaxLength != null) {
        el.title = `Longer than recommended (${recommendedMaxLength} characters). Layout may overflow in the PDF.`;
      } else {
        el.removeAttribute("title");
      }
    }
  }, [value, recommendedMaxLength]);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, []);

  if (!editable) {
    return createElement(Component, { className, style }, children);
  }

  function updateOverRecommended(el: HTMLElement) {
    const over =
      recommendedMaxLength != null &&
      (el.textContent?.length ?? 0) > recommendedMaxLength;
    if (over === overRecommendedRef.current) {
      return;
    }
    overRecommendedRef.current = over;
    el.classList.toggle("ring-1", over);
    el.classList.toggle("ring-amber-500/70", over);
    el.classList.toggle("hover:ring-amber-500/70", over);
    el.classList.toggle("focus-visible:ring-amber-500/70", over);
    if (over && recommendedMaxLength != null) {
      el.title = `Longer than recommended (${recommendedMaxLength} characters). Layout may overflow in the PDF.`;
    } else {
      el.removeAttribute("title");
    }
  }

  function flushToParent(el: HTMLElement) {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    setField(path, el.textContent ?? "");
  }

  function scheduleFlush(el: HTMLElement) {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
    }
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      setField(path, el.textContent ?? "");
    }, 120);
  }

  function handleInput(event: React.FormEvent<HTMLElement>) {
    const el = event.currentTarget;
    updateOverRecommended(el);
    scheduleFlush(el);
  }

  function handlePaste(event: React.ClipboardEvent<HTMLElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text/plain");
    const el = event.currentTarget;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    selection.deleteFromDocument();
    selection.getRangeAt(0).insertNode(document.createTextNode(pasted));
    selection.collapseToEnd();
    updateOverRecommended(el);
    scheduleFlush(el);
  }

  function handleFocus() {
    isFocusedRef.current = true;
    onFieldFocus?.(path);
  }

  function handleBlur(event: React.FocusEvent<HTMLElement>) {
    isFocusedRef.current = false;
    flushToParent(event.currentTarget);
    onFieldFocus?.(null);
  }

  return createElement(Component, {
    ref,
    className: cn(
      className,
      "outline-none transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-primary/40 hover:ring-1 hover:ring-primary/25 rounded-sm",
    ),
    style,
    contentEditable: true,
    suppressContentEditableWarning: true,
    spellCheck: true,
    onInput: handleInput,
    onPaste: handlePaste,
    onFocus: handleFocus,
    onBlur: handleBlur,
  });
}

"use client";

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEditableContext } from "@/components/collateral/sales-brochure/inline/EditableContext";
import type { BrochureBlurbBlock } from "@/lib/collateral/templates/types";

type Props = {
  blocks: BrochureBlurbBlock[];
  onChange: (blocks: BrochureBlurbBlock[]) => void;
  className?: string;
  headingClassName?: string;
  paragraphClassName?: string;
  editorialDropCap?: boolean;
};

type InsertState = {
  afterIndex: number;
  anchorEl: HTMLElement;
  top: number;
  left: number;
} | null;

/** Block index that has a trailing blank line (show inline +). */
type InsertHint = { blockIndex: number } | null;

function stripTrailingBlankLines(text: string): string {
  const lines = text.split("\n");
  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines.join("\n");
}

function hasTrailingBlankLine(text: string): boolean {
  return text.includes("\n") && text.endsWith("\n");
}

function readContentEditableText(element: HTMLElement): string {
  return element.innerText.replace(/\r\n/g, "\n");
}

/** Range.toString() ignores <br>; clone into a node and use innerText instead. */
function fragmentInnerText(range: Range): string {
  const fragment = range.cloneContents();
  const wrapper = document.createElement("div");
  wrapper.appendChild(fragment);
  return wrapper.innerText.replace(/\r\n/g, "\n").replace(/\u200B/g, "");
}

function caretOnBlankLine(element: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  const range = selection.getRangeAt(0);
  if (!element.contains(range.commonAncestorContainer)) {
    return false;
  }

  const after = range.cloneRange();
  after.selectNodeContents(element);
  after.setStart(range.endContainer, range.endOffset);
  if (fragmentInnerText(after).trim().length > 0) {
    return false;
  }

  const inner = readContentEditableText(element);
  if (!inner.length || !inner.includes("\n")) {
    return false;
  }

  // innerText reflects <br> as newlines; the last line is empty after Enter on a new line.
  return (inner.split("\n").pop() ?? "") === "";
}

function measureInsertHint(
  blockIndex: number,
  element: HTMLElement,
  forceAfterEnter = false,
): InsertHint {
  if (forceAfterEnter || caretOnBlankLine(element)) {
    return { blockIndex };
  }
  return null;
}

function BlockInsertPicker({
  insertState,
  onPick,
  onClose,
}: {
  insertState: InsertState;
  onPick: (type: BrochureBlurbBlock["type"]) => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!insertState) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) {
        return;
      }
      if (
        insertState.anchorEl.contains(target) ||
        (target instanceof Element && target.closest("[data-blurb-insert]"))
      ) {
        return;
      }
      onClose();
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [insertState, onClose]);

  if (!insertState || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-[10000] flex flex-col gap-0.5 rounded-lg border border-border bg-background p-1 shadow-lg"
      style={{ top: insertState.top, left: insertState.left }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <button
        type="button"
        role="menuitem"
        className="rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-muted"
        onMouseDown={(event) => {
          event.preventDefault();
          onPick("heading");
        }}
      >
        Section heading
      </button>
      <button
        type="button"
        role="menuitem"
        className="rounded-md px-3 py-2 text-left text-sm font-medium hover:bg-muted"
        onMouseDown={(event) => {
          event.preventDefault();
          onPick("paragraph");
        }}
      >
        Paragraph
      </button>
    </div>,
    document.body,
  );
}

function InlineInsertButton({ onOpen }: { onOpen: (anchorEl: HTMLElement) => void }) {
  const ref = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex items-center py-0.5" data-blurb-insert>
      <button
        ref={ref}
        type="button"
        data-blurb-insert
        aria-label="Add section heading or paragraph"
        className="flex h-6 w-6 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-600 shadow-sm transition hover:border-primary hover:bg-primary/5 hover:text-primary"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => {
          if (ref.current) {
            onOpen(ref.current);
          }
        }}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}

function InlineBlurbBlockField({
  block,
  blockIndex,
  headingClassName,
  paragraphClassName,
  editorialDropCap,
  focusOnMount,
  onUpdate,
  onCommit,
  onBackspaceEmpty,
  onCaretChange,
  onEnterNewLine,
}: {
  block: BrochureBlurbBlock;
  blockIndex: number;
  headingClassName: string;
  paragraphClassName: string;
  editorialDropCap: boolean;
  focusOnMount?: boolean;
  onUpdate: (text: string) => void;
  onCommit: (text: string) => void;
  onBackspaceEmpty: () => void;
  onCaretChange: (index: number, element: HTMLElement) => void;
  onEnterNewLine: (index: number, element: HTMLElement) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const isFocusedRef = useRef(false);
  const { onFieldFocus } = useEditableContext();
  const Component = block.type === "heading" ? "h3" : "p";

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || isFocusedRef.current) {
      return;
    }
    const current = readContentEditableText(el);
    if (current !== block.text) {
      el.textContent = block.text;
    }
  }, [block.text]);

  useLayoutEffect(() => {
    if (!focusOnMount || !ref.current) {
      return;
    }
    const el = ref.current;
    el.focus();
    const selection = window.getSelection();
    if (selection) {
      const range = document.createRange();
      range.selectNodeContents(el);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, [focusOnMount]);

  const syncHint = useCallback(() => {
    const el = ref.current;
    if (!el || !isFocusedRef.current) {
      return;
    }
    onCaretChange(blockIndex, el);
  }, [blockIndex, onCaretChange]);

  const className =
    block.type === "heading"
      ? cn(
          headingClassName,
          "outline-none empty:before:text-muted-foreground/60 empty:before:content-[attr(data-placeholder)]",
        )
      : cn(
          paragraphClassName,
          editorialDropCap &&
            "[&::first-letter]:float-left [&::first-letter]:mr-2.5 [&::first-letter]:mt-1 [&::first-letter]:font-semibold [&::first-letter]:text-[3.6rem] [&::first-letter]:leading-[0.72]",
          "outline-none empty:before:text-muted-foreground/60 empty:before:content-[attr(data-placeholder)]",
        );

  return (
    <Component
      ref={ref as never}
      className={cn(
        className,
        "block w-full min-w-0 cursor-text whitespace-pre-wrap break-words outline-none",
        block.type === "paragraph" && "min-h-[1.2em]",
      )}
      style={{
        fontFamily:
          block.type === "heading"
            ? "var(--report-heading-font, inherit)"
            : "var(--report-body-font, inherit)",
      }}
      contentEditable
      suppressContentEditableWarning
      spellCheck
      data-placeholder={
        block.type === "heading" ? "Section heading" : "Type here…"
      }
      onInput={(event) => {
        onUpdate(readContentEditableText(event.currentTarget));
        syncHint();
      }}
      onFocus={() => {
        isFocusedRef.current = true;
        onFieldFocus?.("copy.blurb");
      }}
      onBlur={(event) => {
        isFocusedRef.current = false;
        onCommit(readContentEditableText(event.currentTarget));
        onFieldFocus?.(null);
        onCaretChange(blockIndex, event.currentTarget);
      }}
      onKeyUp={(event) => {
        if (event.key === "Enter") {
          const el = event.currentTarget;
          requestAnimationFrame(() => {
            onEnterNewLine(blockIndex, el);
          });
        }
      }}
      onKeyDown={(event) => {
        const el = event.currentTarget;
        if (event.key === "Backspace" && !readContentEditableText(el).length) {
          event.preventDefault();
          onBackspaceEmpty();
        }
      }}
    />
  );
}

export function InlineBlurbEditor({
  blocks,
  onChange,
  className,
  headingClassName = "text-sm font-semibold uppercase tracking-wide text-neutral-900",
  paragraphClassName = "text-[0.9rem] leading-relaxed text-neutral-700",
  editorialDropCap = false,
}: Props) {
  const [insertState, setInsertState] = useState<InsertState>(null);
  const [insertHint, setInsertHint] = useState<InsertHint>(null);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const onChangeRef = useRef(onChange);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blocksRef = useRef(blocks);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  const flushBlocks = useCallback((next: BrochureBlurbBlock[]) => {
    blocksRef.current = next;
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    onChangeRef.current(next);
  }, []);

  const scheduleBlocks = useCallback((next: BrochureBlurbBlock[]) => {
    blocksRef.current = next;
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
    }
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      onChangeRef.current(next);
    }, 120);
  }, []);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (focusIndex == null) {
      return;
    }
    const timer = window.setTimeout(() => setFocusIndex(null), 0);
    return () => window.clearTimeout(timer);
  }, [focusIndex]);

  const handleCaretChange = useCallback((blockIndex: number, element: HTMLElement) => {
    if (document.activeElement !== element) {
      setInsertHint((current) =>
        current?.blockIndex === blockIndex ? null : current,
      );
      return;
    }
    setInsertHint(measureInsertHint(blockIndex, element));
  }, []);

  const handleEnterNewLine = useCallback((blockIndex: number, element: HTMLElement) => {
    setInsertHint(measureInsertHint(blockIndex, element, true));
  }, []);

  function updateBlock(index: number, text: string) {
    const next = [...blocksRef.current];
    const block = next[index];
    if (!block) {
      return;
    }
    next[index] = { ...block, text };
    scheduleBlocks(next);
  }

  function commitBlock(index: number, text: string) {
    const next = [...blocksRef.current];
    const block = next[index];
    if (!block) {
      return;
    }
    next[index] = { ...block, text: text.replace(/\n+$/, "") };
    flushBlocks(next);
  }

  function removeBlock(index: number) {
    const next = blocksRef.current.filter((_, i) => i !== index);
    flushBlocks(next);
    setInsertState(null);
    setInsertHint(null);
  }

  function insertBlock(afterIndex: number, type: BrochureBlurbBlock["type"]) {
    const next = [...blocksRef.current];
    const current = next[afterIndex];
    if (!current) {
      return;
    }

    const insertAt = afterIndex + 1;
    if (hasTrailingBlankLine(current.text)) {
      next[afterIndex] = {
        ...current,
        text: stripTrailingBlankLines(current.text),
      };
    }
    next.splice(insertAt, 0, { type, text: "" });
    flushBlocks(next);
    setInsertState(null);
    setInsertHint(null);
    setFocusIndex(insertAt);
  }

  function openInsertMenu(afterIndex: number, anchorEl: HTMLElement) {
    const rect = anchorEl.getBoundingClientRect();
    setInsertState({
      afterIndex,
      anchorEl,
      top: rect.bottom + 6,
      left: rect.left,
    });
  }

  let firstParagraph = true;

  if (blocks.length === 0) {
    return (
      <div
        className={cn(
          "brochure-blurb-editor relative min-w-0 overflow-visible rounded-sm focus-within:ring-2 focus-within:ring-primary/50",
          className,
        )}
      >
        <InlineBlurbBlockField
          block={{ type: "paragraph", text: "" }}
          blockIndex={0}
          headingClassName={headingClassName}
          paragraphClassName={paragraphClassName}
          editorialDropCap={editorialDropCap}
          focusOnMount
          onUpdate={(text) => scheduleBlocks([{ type: "paragraph", text }])}
          onCommit={(text) => flushBlocks([{ type: "paragraph", text }])}
          onBackspaceEmpty={() => flushBlocks([])}
          onCaretChange={handleCaretChange}
          onEnterNewLine={handleEnterNewLine}
        />
        <BlockInsertPicker
          insertState={insertState}
          onPick={(type) => insertBlock(insertState?.afterIndex ?? -1, type)}
          onClose={() => setInsertState(null)}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "brochure-blurb-editor relative min-w-0 overflow-visible rounded-sm focus-within:ring-2 focus-within:ring-primary/50",
        className,
      )}
    >
      <div className="flex flex-col gap-0.5 py-0.5">
        {blocks.map((block, index) => {
          const useDropCap =
            editorialDropCap && block.type === "paragraph" && firstParagraph;
          if (block.type === "paragraph") {
            firstParagraph = false;
          }

          return (
            <Fragment key={`blurb-${index}-${block.type}`}>
              <InlineBlurbBlockField
                block={block}
                blockIndex={index}
                headingClassName={headingClassName}
                paragraphClassName={paragraphClassName}
                editorialDropCap={useDropCap}
                focusOnMount={focusIndex === index}
                onUpdate={(text) => updateBlock(index, text)}
                onCommit={(text) => commitBlock(index, text)}
                onBackspaceEmpty={() => removeBlock(index)}
                onCaretChange={handleCaretChange}
                onEnterNewLine={handleEnterNewLine}
              />
              {insertHint?.blockIndex === index && !insertState ? (
                <InlineInsertButton
                  onOpen={(anchor) => openInsertMenu(index, anchor)}
                />
              ) : null}
            </Fragment>
          );
        })}
      </div>

      <BlockInsertPicker
        insertState={insertState}
        onPick={(type) => {
          if (insertState) {
            insertBlock(insertState.afterIndex, type);
          }
        }}
        onClose={() => setInsertState(null)}
      />
    </div>
  );
}

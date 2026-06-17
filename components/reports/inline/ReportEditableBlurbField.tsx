"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  blurbBlocksToPlainText,
  blurbStringToBlocks,
  normalizeBlurbBlocksForEditor,
} from "@/lib/collateral/sales-brochure/blurbBlocks";
import {
  blurbBlocksEqual,
  blurbBlocksToTiptapContent,
  tiptapDocToBlurbBlocks,
} from "@/lib/collateral/sales-brochure/blurbBlocksTiptap";
import type { BrochureBlurbBlock } from "@/lib/collateral/templates/types";
import { useReportEditableContext } from "@/components/reports/inline/ReportEditableContext";

type Props = {
  blurb: string;
  onChange: (blurb: string) => void;
  className?: string;
  headingClassName?: string;
  paragraphClassName?: string;
};

function BlurbFormatButton({
  active,
  label,
  brandPrimaryColour,
  onClick,
}: {
  active: boolean;
  label: string;
  brandPrimaryColour: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border px-2.5 py-1 text-xs font-medium leading-none transition-all duration-200",
        active
          ? "border-transparent text-primary-foreground shadow-sm"
          : "border-border/80 bg-background text-foreground hover:border-hiline-green/40 hover:bg-muted/60",
      )}
      style={active ? { backgroundColor: brandPrimaryColour } : undefined}
    >
      {label}
    </button>
  );
}

function BlurbBubbleToolbar({
  editor,
  brandPrimaryColour,
}: {
  editor: Editor;
  brandPrimaryColour: string;
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-xl border border-border/80 bg-background/95 p-1 shadow-md ring-1 ring-foreground/5 backdrop-blur-sm"
      onMouseDown={(event) => event.preventDefault()}
    >
      <BlurbFormatButton
        label="Paragraph"
        active={editor.isActive("paragraph")}
        brandPrimaryColour={brandPrimaryColour}
        onClick={() => editor.chain().focus().setParagraph().run()}
      />
      <BlurbFormatButton
        label="Header"
        active={editor.isActive("heading", { level: 3 })}
        brandPrimaryColour={brandPrimaryColour}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      />
    </div>
  );
}

function blocksFromBlurb(blurb: string): BrochureBlurbBlock[] {
  return normalizeBlurbBlocksForEditor(blurbStringToBlocks(blurb));
}

export function ReportEditableBlurbField({
  blurb,
  onChange,
  className,
  headingClassName = "text-sm font-semibold uppercase tracking-wide text-neutral-900",
  paragraphClassName = "text-[0.9rem] leading-normal text-neutral-700",
}: Props) {
  const onChangeRef = useRef(onChange);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { onFieldFocus, brandPrimaryColour, blurbFlushRef } =
    useReportEditableContext();

  const blocks = useMemo(() => blocksFromBlurb(blurb), [blurb]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        blockquote: false,
        bold: false,
        bulletList: false,
        code: false,
        codeBlock: false,
        horizontalRule: false,
        italic: false,
        orderedList: false,
        strike: false,
        heading: {
          levels: [3],
          HTMLAttributes: {
            class: headingClassName,
            style: "font-family: var(--report-heading-font, inherit)",
          },
        },
        paragraph: {
          HTMLAttributes: {
            class: paragraphClassName,
            style: "font-family: var(--report-body-font, inherit)",
          },
        },
      }),
      Placeholder.configure({
        placeholder: "Click to edit the property description…",
      }),
    ],
    [headingClassName, paragraphClassName],
  );

  const emitBlurb = useCallback((nextBlocks: BrochureBlurbBlock[]) => {
    onChangeRef.current(blurbBlocksToPlainText(normalizeBlurbBlocksForEditor(nextBlocks)));
  }, []);

  const scheduleEmit = useCallback(
    (editor: Editor) => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        emitBlurb(tiptapDocToBlurbBlocks(editor.getJSON()));
      }, 120);
    },
    [emitBlurb],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: blurbBlocksToTiptapContent(blocks),
    editorProps: {
      attributes: {
        class: cn(
          "tiptap min-h-[4.5rem] w-full min-w-0 outline-none",
          className,
        ),
      },
    },
    onUpdate: ({ editor: ed }) => {
      scheduleEmit(ed);
    },
    onFocus: () => {
      onFieldFocus?.("copy.blurb");
    },
    onBlur: ({ editor: ed }) => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      emitBlurb(tiptapDocToBlurbBlocks(ed.getJSON()));
      onFieldFocus?.(null);
    },
  });

  useEffect(() => {
    if (!editor || !blurbFlushRef) {
      return;
    }
    blurbFlushRef.current = () => {
      const flushed = tiptapDocToBlurbBlocks(editor.getJSON());
      return blurbBlocksToPlainText(normalizeBlurbBlocksForEditor(flushed));
    };
    return () => {
      blurbFlushRef.current = null;
    };
  }, [blurbFlushRef, editor]);

  useEffect(() => {
    if (!editor || editor.isFocused) {
      return;
    }
    const parsed = tiptapDocToBlurbBlocks(editor.getJSON());
    if (blurbBlocksEqual(parsed, blocks)) {
      return;
    }
    editor.commands.setContent(blurbBlocksToTiptapContent(blocks), {
      emitUpdate: false,
    });
  }, [blocks, editor]);

  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
    };
  }, []);

  return (
    <div className="report-blurb-editor relative z-10 min-w-0 overflow-visible rounded-sm focus-within:ring-2 focus-within:ring-primary/50">
      {editor ? (
        <BubbleMenu
          editor={editor}
          shouldShow={({ editor: ed }) => ed.isFocused}
          appendTo={() => document.body}
          options={{
            placement: "top",
            offset: 6,
            strategy: "fixed",
          }}
        >
          <BlurbBubbleToolbar
            editor={editor}
            brandPrimaryColour={brandPrimaryColour}
          />
        </BubbleMenu>
      ) : null}
      <EditorContent editor={editor} />
    </div>
  );
}

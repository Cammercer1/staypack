"use client";

import { EditableBlurbField } from "@/components/collateral/sales-brochure/inline/EditableBlurbField";
import { useEditableContext } from "@/components/collateral/sales-brochure/inline/EditableContext";
import { cn } from "@/lib/utils";
import { getBlurbBlocks, getBlurbBlocksForEditor, sliceBlurbBlocksByParagraphs } from "@/lib/collateral/sales-brochure/blurbBlocks";
import type { BrochureBlurbBlock, BrochureDocumentJson } from "@/lib/collateral/templates/types";

type Props = {
  document: BrochureDocumentJson;
  className?: string;
  headingClassName?: string;
  paragraphClassName?: string;
  /** First paragraph uses editorial drop-cap styling. */
  editorialDropCap?: boolean;
  maxParagraphs?: number;
  blocks?: BrochureBlurbBlock[];
};

function stripLineClampForEditor(className?: string) {
  if (!className) {
    return undefined;
  }
  const stripped = className
    .split(/\s+/)
    .filter((token) => token && !token.startsWith("line-clamp-"))
    .join(" ");
  return stripped || undefined;
}

export function BrochureBlurbContent({
  document,
  className,
  headingClassName = "text-sm font-semibold uppercase tracking-wide text-neutral-900",
  paragraphClassName = "text-[0.9rem] leading-normal text-neutral-700",
  editorialDropCap = false,
  maxParagraphs,
  blocks: blocksProp,
}: Props) {
  const { editable, showFullBlurb, blurbBlocks, setBlurbBlocks } = useEditableContext();
  const allBlocks = editable
    ? blurbBlocks
    : showFullBlurb
      ? getBlurbBlocksForEditor(document.copy)
      : (blocksProp ?? getBlurbBlocks(document.copy));

  const blurbClassName =
    editable || showFullBlurb ? stripLineClampForEditor(className) : className;

  if (editable) {
    return (
      <div
        className={cn(
          "relative z-10 min-w-0 shrink-0 overflow-visible",
          blurbClassName,
        )}
      >
        <EditableBlurbField
          blocks={allBlocks}
          onChange={setBlurbBlocks}
          headingClassName={headingClassName}
          paragraphClassName={paragraphClassName}
        />
      </div>
    );
  }

  const { visible } =
    maxParagraphs != null && !showFullBlurb
      ? sliceBlurbBlocksByParagraphs(allBlocks, maxParagraphs)
      : { visible: allBlocks };

  if (!visible.length) {
    return null;
  }

  let firstParagraphDone = false;

  return (
    <div className={cn("space-y-3", blurbClassName)}>
      {visible.map((block, index) => {
        if (block.type === "heading") {
          if (!block.text.trim()) {
            return null;
          }
          return (
            <h3
              key={`heading-${index}`}
              className={cn(headingClassName)}
              style={{ fontFamily: "var(--report-heading-font, inherit)" }}
            >
              {block.text}
            </h3>
          );
        }

        if (!block.text.trim()) {
          return (
            <div
              key={`spacer-${index}`}
              className="h-[0.85rem] shrink-0"
              aria-hidden
            />
          );
        }

        const useDropCap = editorialDropCap && !firstParagraphDone;
        firstParagraphDone = true;

        return (
          <p
            key={`paragraph-${index}`}
            className={cn(
              paragraphClassName,
              useDropCap &&
                "[&::first-letter]:float-left [&::first-letter]:mr-2.5 [&::first-letter]:mt-1 [&::first-letter]:font-semibold [&::first-letter]:text-[3.6rem] [&::first-letter]:leading-[0.72]",
            )}
            style={{ fontFamily: "var(--report-body-font, inherit)" }}
          >
            {block.text.split("\n").map((line, lineIndex, lines) => (
              <span key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                {line}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

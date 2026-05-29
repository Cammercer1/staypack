"use client";

import { EditableBlurbField } from "@/components/collateral/sales-brochure/inline/EditableBlurbField";
import { useEditableContext } from "@/components/collateral/sales-brochure/inline/EditableContext";
import { cn } from "@/lib/utils";
import { getBlurbBlocks, sliceBlurbBlocksByParagraphs } from "@/lib/collateral/sales-brochure/blurbBlocks";
import type { BrochureBlurbBlock, SalesBrochureDocumentJson } from "@/lib/collateral/templates/types";

type Props = {
  document: SalesBrochureDocumentJson;
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
  const { editable, blurbBlocks, setBlurbBlocks } = useEditableContext();
  const allBlocks = editable
    ? blurbBlocks
    : (blocksProp ?? getBlurbBlocks(document.copy));

  if (editable) {
    return (
      <div
        className={cn(
          "relative z-10 min-w-0 shrink-0 overflow-visible",
          stripLineClampForEditor(className),
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
    maxParagraphs != null
      ? sliceBlurbBlocksByParagraphs(allBlocks, maxParagraphs)
      : { visible: allBlocks };

  if (!visible.length) {
    return null;
  }

  let firstParagraphDone = false;

  return (
    <div className={cn("space-y-3", className)}>
      {visible.map((block, index) => {
        if (block.type === "heading") {
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
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

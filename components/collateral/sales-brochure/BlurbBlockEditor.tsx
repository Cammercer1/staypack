"use client";

import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  BLURB_BLOCKS_MAX,
  BLURB_HEADING_MAX,
  BLURB_PARAGRAPH_MAX,
  BLURB_TOTAL_RECOMMENDED,
  blurbTotalCharacters,
} from "@/lib/collateral/sales-brochure/blurbBlocks";
import type { BrochureBlurbBlock } from "@/lib/collateral/templates/types";
import { cn } from "@/lib/utils";

type Props = {
  blocks: BrochureBlurbBlock[];
  onChange: (blocks: BrochureBlurbBlock[]) => void;
};

export function BlurbBlockEditor({ blocks, onChange }: Props) {
  const totalChars = blurbTotalCharacters(blocks);
  const overRecommended = totalChars > BLURB_TOTAL_RECOMMENDED;

  function updateBlock(index: number, next: BrochureBlurbBlock) {
    const copy = [...blocks];
    copy[index] = next;
    onChange(copy);
  }

  function removeBlock(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }

  function moveBlock(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) {
      return;
    }
    const copy = [...blocks];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item!);
    onChange(copy);
  }

  function addBlock(type: BrochureBlurbBlock["type"]) {
    if (blocks.length >= BLURB_BLOCKS_MAX) {
      return;
    }
    onChange([...blocks, { type, text: "" }]);
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Property description</Label>
        <p className="mt-1 text-xs text-muted-foreground">
          Build your description with short paragraphs and optional section headings.
          Use as much or as little space as you need.
        </p>
      </div>

      {blocks.length === 0 ? (
        <p className="rounded-lg border border-dashed bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
          No description yet. Add a paragraph to get started, or add a section heading
          first.
        </p>
      ) : null}

      <div className="space-y-3">
        {blocks.map((block, index) => (
          <div
            key={`blurb-block-${index}`}
            className="rounded-lg border border-border/80 bg-background p-3 shadow-sm"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {block.type === "heading" ? "Section heading" : "Paragraph"}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={index === 0}
                  aria-label="Move up"
                  onClick={() => moveBlock(index, -1)}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={index === blocks.length - 1}
                  aria-label="Move down"
                  onClick={() => moveBlock(index, 1)}
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  aria-label="Remove"
                  onClick={() => removeBlock(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {block.type === "heading" ? (
              <Input
                value={block.text}
                placeholder="e.g. Outdoor living"
                maxLength={BLURB_HEADING_MAX}
                onChange={(event) =>
                  updateBlock(index, { type: "heading", text: event.target.value })
                }
              />
            ) : (
              <Textarea
                value={block.text}
                rows={4}
                placeholder="Write a paragraph about the property…"
                onChange={(event) =>
                  updateBlock(index, { type: "paragraph", text: event.target.value })
                }
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={blocks.length >= BLURB_BLOCKS_MAX}
          onClick={() => addBlock("paragraph")}
        >
          Add paragraph
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={blocks.length >= BLURB_BLOCKS_MAX}
          onClick={() => addBlock("heading")}
        >
          Add section heading
        </Button>
      </div>

      <p
        className={cn(
          "text-xs",
          overRecommended ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
        )}
      >
        {totalChars} characters
        {overRecommended
          ? ` (recommended ${BLURB_TOTAL_RECOMMENDED} — layout may overflow)`
          : ` (recommended ${BLURB_TOTAL_RECOMMENDED})`}
      </p>
    </div>
  );
}

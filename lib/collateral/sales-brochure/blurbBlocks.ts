import type { BrochureBlurbBlock, SalesBrochureCopyJson } from "@/lib/collateral/templates/types";

export const BLURB_HEADING_MAX = 80;
export const BLURB_PARAGRAPH_MAX = 600;
export const BLURB_BLOCKS_MAX = 16;
export const BLURB_TOTAL_RECOMMENDED = 1200;

type LegacyCopy = SalesBrochureCopyJson & {
  blurb_blocks?: BrochureBlurbBlock[];
};

function trimBlock(block: BrochureBlurbBlock): BrochureBlurbBlock | null {
  const text = block.text.trim();
  if (!text) {
    return null;
  }
  return { type: block.type, text };
}

export function blurbBlocksToPlainText(blocks: BrochureBlurbBlock[]): string {
  return blocks
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

/** Single-field editor text: `### Heading` lines become section headings. */
export function blurbBlocksToEditableText(blocks: BrochureBlurbBlock[]): string {
  return blocks
    .map((block) =>
      block.type === "heading" ? `### ${block.text}` : block.text,
    )
    .join("\n\n");
}

/** Split legacy plain blurb into blocks (paragraphs; `### Title` → heading). */
export function blurbStringToBlocks(blurb: string): BrochureBlurbBlock[] {
  const chunks = blurb.split(/\n\n+/).map((part) => part.trim()).filter(Boolean);
  const blocks: BrochureBlurbBlock[] = [];

  for (const chunk of chunks) {
    const headingMatch = chunk.match(/^#{1,3}\s+(.+)$/);
    if (headingMatch) {
      blocks.push({ type: "heading", text: headingMatch[1]!.trim() });
      continue;
    }

    const lines = chunk.split("\n");
    const inlineHeadings: BrochureBlurbBlock[] = [];
    let paragraphLines: string[] = [];

    for (const line of lines) {
      const h = line.match(/^#{1,3}\s+(.+)$/);
      if (h) {
        if (paragraphLines.length) {
          inlineHeadings.push({
            type: "paragraph",
            text: paragraphLines.join("\n").trim(),
          });
          paragraphLines = [];
        }
        inlineHeadings.push({ type: "heading", text: h[1]!.trim() });
      } else {
        paragraphLines.push(line);
      }
    }

    if (paragraphLines.length) {
      inlineHeadings.push({
        type: "paragraph",
        text: paragraphLines.join("\n").trim(),
      });
    }

    if (inlineHeadings.length) {
      blocks.push(...inlineHeadings);
    } else {
      blocks.push({ type: "paragraph", text: chunk });
    }
  }

  if (blocks.length === 0 && blurb.trim()) {
    blocks.push({ type: "paragraph", text: blurb.trim() });
  }

  return blocks;
}

export function getBlurbBlocks(copy: LegacyCopy): BrochureBlurbBlock[] {
  if (Array.isArray(copy.blurb_blocks) && copy.blurb_blocks.length > 0) {
    return copy.blurb_blocks
      .map((block) => trimBlock(block))
      .filter((block): block is BrochureBlurbBlock => block != null);
  }

  return blurbStringToBlocks(copy.blurb ?? "");
}

export function normalizeBlurbBlocks(blocks: BrochureBlurbBlock[]): BrochureBlurbBlock[] {
  return blocks
    .slice(0, BLURB_BLOCKS_MAX)
    .map((block) => trimBlock(block))
    .filter((block): block is BrochureBlurbBlock => block != null);
}

/** Keeps empty blocks so the inline editor can insert and focus new headings/paragraphs. */
export function normalizeBlurbBlocksForEditor(
  blocks: BrochureBlurbBlock[],
): BrochureBlurbBlock[] {
  return blocks.slice(0, BLURB_BLOCKS_MAX).map((block) => ({
    type: block.type === "heading" ? "heading" : "paragraph",
    text: typeof block.text === "string" ? block.text : "",
  }));
}

export function getBlurbBlocksForEditor(copy: LegacyCopy): BrochureBlurbBlock[] {
  if (Array.isArray(copy.blurb_blocks)) {
    if (copy.blurb_blocks.length > 0) {
      return copy.blurb_blocks.slice(0, BLURB_BLOCKS_MAX).map((block) => ({
        type: block.type === "heading" ? "heading" : "paragraph",
        text: typeof block.text === "string" ? block.text : "",
      }));
    }
  }

  return blurbStringToBlocks(copy.blurb ?? "");
}

function blurbBlocksFromRawArray(data: Record<string, unknown>, keepEmpty: boolean) {
  if (!Array.isArray(data.blurb_blocks)) {
    return null;
  }

  const blocks: BrochureBlurbBlock[] = [];
  for (const item of data.blurb_blocks) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const row = item as Record<string, unknown>;
    const text = typeof row.text === "string" ? row.text : "";
    const trimmed = text.trim();
    if (!keepEmpty && !trimmed) {
      continue;
    }
    if (row.type === "heading") {
      blocks.push({ type: "heading", text: keepEmpty ? text : trimmed });
    } else if (row.type === "paragraph") {
      blocks.push({ type: "paragraph", text: keepEmpty ? text : trimmed });
    }
  }

  return blocks.length ? blocks : null;
}

export function blurbBlocksFromRaw(data: Record<string, unknown>): BrochureBlurbBlock[] {
  const blocks = blurbBlocksFromRawArray(data, false);
  if (blocks) {
    return normalizeBlurbBlocks(blocks);
  }

  const blurb = typeof data.blurb === "string" ? data.blurb : "";
  return blurbStringToBlocks(blurb);
}

export function blurbBlocksFromRawForEditor(data: Record<string, unknown>): BrochureBlurbBlock[] {
  const blocks = blurbBlocksFromRawArray(data, true);
  if (blocks) {
    return normalizeBlurbBlocksForEditor(blocks);
  }

  const blurb = typeof data.blurb === "string" ? data.blurb : "";
  return blurbStringToBlocks(blurb);
}

export function blurbTotalCharacters(blocks: BrochureBlurbBlock[]): number {
  return blocks.reduce((sum, block) => sum + block.text.length, 0);
}

/** Split by paragraph count for multi-page minimalist layouts. Headings stay with following content. */
export function sliceBlurbBlocksByParagraphs(
  blocks: BrochureBlurbBlock[],
  maxParagraphs: number,
): { visible: BrochureBlurbBlock[]; remainder: BrochureBlurbBlock[] } {
  let paragraphCount = 0;
  const visible: BrochureBlurbBlock[] = [];
  const remainder: BrochureBlurbBlock[] = [];
  let inRemainder = false;

  for (const block of blocks) {
    if (inRemainder) {
      remainder.push(block);
      continue;
    }

    if (block.type === "paragraph") {
      if (paragraphCount >= maxParagraphs) {
        inRemainder = true;
        remainder.push(block);
        continue;
      }
      paragraphCount += 1;
    }

    visible.push(block);
  }

  return { visible, remainder };
}

export function hasBlurbContent(copy: LegacyCopy): boolean {
  return getBlurbBlocks(copy).length > 0 || Boolean(copy.blurb?.trim());
}

import type { JSONContent } from "@tiptap/core";
import type { BrochureBlurbBlock } from "@/lib/collateral/templates/types";
import { normalizeBlurbBlocksForEditor } from "@/lib/collateral/sales-brochure/blurbBlocks";

const BROCHURE_HEADING_LEVEL = 3;

function inlineTextFromNode(node: JSONContent): string {
  if (!node.content?.length) {
    return "";
  }

  const parts: string[] = [];
  for (const child of node.content) {
    if (child.type === "text" && typeof child.text === "string") {
      parts.push(child.text);
    } else if (child.type === "hardBreak") {
      parts.push("\n");
    }
  }

  return parts.join("");
}

export function blurbBlocksToTiptapContent(blocks: BrochureBlurbBlock[]): JSONContent {
  const content: JSONContent[] = blocks.map((block) => {
    const inline = inlineContentFromText(block.text);
    if (block.type === "heading") {
      return {
        type: "heading",
        attrs: { level: BROCHURE_HEADING_LEVEL },
        content: inline,
      };
    }
    return { type: "paragraph", content: inline };
  });

  if (!content.length) {
    content.push({ type: "paragraph" });
  }

  return { type: "doc", content };
}

function inlineContentFromText(text: string): JSONContent[] | undefined {
  if (!text) {
    return undefined;
  }

  const lines = text.split("\n");
  const nodes: JSONContent[] = [];

  lines.forEach((line, index) => {
    if (line) {
      nodes.push({ type: "text", text: line });
    }
    if (index < lines.length - 1) {
      nodes.push({ type: "hardBreak" });
    }
  });

  return nodes.length ? nodes : undefined;
}

export function tiptapDocToBlurbBlocks(doc: JSONContent): BrochureBlurbBlock[] {
  const blocks: BrochureBlurbBlock[] = [];

  for (const node of doc.content ?? []) {
    if (node.type === "heading") {
      blocks.push({ type: "heading", text: inlineTextFromNode(node) });
      continue;
    }
    if (node.type === "paragraph") {
      blocks.push({ type: "paragraph", text: inlineTextFromNode(node) });
    }
  }

  const normalized = normalizeBlurbBlocksForEditor(blocks);
  return normalized.length ? normalized : [{ type: "paragraph", text: "" }];
}

export function blurbBlocksEqual(a: BrochureBlurbBlock[], b: BrochureBlurbBlock[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every(
    (block, index) =>
      block.type === b[index]?.type && block.text === b[index]?.text,
  );
}

"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useState } from "react";
import {
  Bold,
  Check,
  Heading2,
  Heading3,
  Italic,
  Loader2,
  Pencil,
  Pilcrow,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

type Props = {
  listingId: string;
  initialDescription: string;
  primaryColour: string;
};

// ── Toolbar button ────────────────────────────────────────────────────────────

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault(); // keep editor focus
        onClick();
      }}
      title={title}
      className={`flex h-7 w-7 items-center justify-center transition-colors ${
        active
          ? "bg-black/10 text-black"
          : "text-black/50 hover:bg-black/5 hover:text-black"
      }`}
    >
      {children}
    </button>
  );
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

function Toolbar({
  editor,
  generating,
  saving,
  onGenerate,
  onSave,
  onCancel,
  primaryColour,
}: {
  editor: ReturnType<typeof useEditor>;
  generating: boolean;
  saving: boolean;
  onGenerate: () => void;
  onSave: () => void;
  onCancel: () => void;
  primaryColour: string;
}) {
  if (!editor) return null;

  return (
    <div className="flex flex-wrap items-center gap-1 border border-black/15 bg-white px-2 py-1">
      {/* Format controls */}
      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={() => editor.chain().focus().setParagraph().run()}
          active={editor.isActive("paragraph")}
          title="Normal text"
        >
          <Pilcrow className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          active={editor.isActive("heading", { level: 2 })}
          title="Heading 2"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          active={editor.isActive("heading", { level: 3 })}
          title="Heading 3"
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      <div className="h-4 w-px bg-black/10" />

      <div className="flex items-center gap-0.5">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onGenerate}
          disabled={generating || saving}
          className="flex items-center gap-1.5 border border-black/15 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-black/5 disabled:opacity-50"
        >
          {generating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          {generating ? "Generating…" : "Generate with AI"}
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={saving || generating}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50"
          style={{ backgroundColor: primaryColour }}
        >
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
          Save
        </button>

        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="flex items-center gap-1 text-xs opacity-40 hover:opacity-70 disabled:opacity-20"
        >
          <X className="h-3 w-3" />
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

// Convert simple markdown to HTML so existing descriptions render correctly
function mdToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .split(/\n{2,}/)
    .map((block) => {
      if (/<h[23]>/.test(block)) return block.trim();
      return `<p>${block.trim().replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

export function InlineDescriptionEditor({
  listingId,
  initialDescription,
  primaryColour,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [savedHtml, setSavedHtml] = useState(() => {
    // If the stored value looks like plain text / markdown, convert on first load
    if (initialDescription.startsWith("<")) return initialDescription;
    return mdToHtml(initialDescription);
  });
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ blockquote: false, codeBlock: false, code: false, horizontalRule: false }),
        Placeholder.configure({ placeholder: "Write a property description…" }),
      ],
      content: savedHtml,
      editorProps: {
        attributes: {
          class:
            "min-h-[220px] px-4 py-3 outline-none prose prose-sm max-w-none " +
            "prose-headings:font-semibold prose-headings:text-inherit prose-headings:mt-4 prose-headings:mb-1 " +
            "prose-h2:text-base prose-h3:text-sm " +
            "prose-p:leading-7 prose-p:text-inherit",
        },
      },
    },
    [editing], // re-create when editing toggles so content syncs
  );

  function startEditing() {
    setEditing(true);
  }

  function cancelEditing() {
    // Reset editor to saved state
    editor?.commands.setContent(savedHtml);
    setEditing(false);
  }

  async function saveDescription() {
    if (!editor) return;
    setSaving(true);
    const html = editor.getHTML();

    try {
      const response = await fetch(`/api/listings/${listingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_description: html }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to save");

      setSavedHtml(html);
      setEditing(false);
      toast.success("Description saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  }

  async function generateDescription() {
    setGenerating(true);
    try {
      const response = await fetch(
        `/api/listings/${listingId}/generate-description`,
        { method: "POST" },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to generate");

      // API returns markdown — convert to HTML and load into editor
      const html = mdToHtml(payload.description as string);
      editor?.commands.setContent(html);
      if (!editing) setEditing(true);
      toast.success("Generated — review and save");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to generate");
    } finally {
      setGenerating(false);
    }
  }

  // ── Read-only view ─────────────────────────────────────────────────────────

  if (!editing) {
    return (
      <div className="group relative">
        {savedHtml ? (
          <div
            className="prose prose-sm max-w-none opacity-80
              prose-headings:font-semibold prose-headings:text-inherit prose-headings:mt-6 prose-headings:mb-2
              prose-h2:text-base prose-h3:text-sm
              prose-p:leading-7 prose-p:text-inherit"
            dangerouslySetInnerHTML={{ __html: savedHtml }}
          />
        ) : (
          <p className="text-sm italic opacity-40">No description yet.</p>
        )}

        <div className="mt-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={startEditing}
            className="flex items-center gap-1.5 border border-black/15 bg-white px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-black/5"
          >
            <Pencil className="h-3 w-3" />
            Edit
          </button>
          <button
            type="button"
            onClick={generateDescription}
            disabled={generating}
            className="flex items-center gap-1.5 border border-black/15 bg-white px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-black/5 disabled:opacity-50"
          >
            {generating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            {generating ? "Generating…" : "Generate with AI"}
          </button>
        </div>
      </div>
    );
  }

  // ── Editor view ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-0 border border-black/15 bg-white">
      <Toolbar
        editor={editor}
        generating={generating}
        saving={saving}
        onGenerate={generateDescription}
        onSave={saveDescription}
        onCancel={cancelEditing}
        primaryColour={primaryColour}
      />
      <EditorContent editor={editor} />
    </div>
  );
}

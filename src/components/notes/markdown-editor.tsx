"use client";

import type { Editor } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import {
  Bold,
  Check,
  Code,
  Code2,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Table2,
  Trash2,
  Underline,
  Undo2,
  Unlink,
} from "lucide-react";
import { forwardRef, type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  createNoteEditorExtensions,
  isSafeNoteLink,
  prepareNoteMarkdown,
  serializeNoteMarkdown,
} from "./markdown-editor-config";

type ToolbarButtonProps = {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
};

const ToolbarButton = forwardRef<HTMLButtonElement, ToolbarButtonProps>(function ToolbarButton(
  { label, active = false, disabled = false, onClick, children },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-40",
        active && "bg-muted text-foreground",
      )}
    >
      {children}
    </button>
  );
});

function LinkControl({ editor, active }: { editor: Editor; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");
  const [error, setError] = useState("");

  const changeOpen = (next: boolean) => {
    setOpen(next);
    setError("");
    if (next) setHref(String(editor.getAttributes("link").href ?? ""));
  };

  const applyLink = () => {
    const next = href.trim();
    if (!isSafeNoteLink(next)) {
      setError("Use an http, https, or mailto link.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: next }).run();
    setOpen(false);
  };

  const removeLink = () => {
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <ToolbarButton label={active ? "Edit link" : "Add link"} active={active}>
          <Link2 className="size-3.5" />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <div className="space-y-2">
          <label className="text-xs font-medium" htmlFor="note-link-url">Link address</label>
          <Input
            id="note-link-url"
            value={href}
            onChange={(event) => setHref(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") applyLink();
            }}
            placeholder="https://example.com"
            className="h-8 text-xs"
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center justify-between gap-2">
            {active ? (
              <Button type="button" variant="ghost" size="sm" onClick={removeLink}>
                <Unlink /> Remove
              </Button>
            ) : <span />}
            <Button type="button" size="sm" onClick={applyLink}>
              <Check /> Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TableControl({ editor, active }: { editor: Editor; active: boolean }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <ToolbarButton label="Table options" active={active}>
          <Table2 className="size-3.5" />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-2">
        {!active ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          >
            <Table2 /> Insert 3 × 3 table
          </Button>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().addColumnAfter().run()}>Add column</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().deleteColumn().run()}>Delete column</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().addRowAfter().run()}>Add row</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => editor.chain().focus().deleteRow().run()}>Delete row</Button>
            <Button type="button" variant="ghost" size="sm" className="col-span-2 text-destructive" onClick={() => editor.chain().focus().deleteTable().run()}>
              <Trash2 /> Delete table
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function EditorToolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      bold: current.isActive("bold"),
      italic: current.isActive("italic"),
      underline: current.isActive("underline"),
      strike: current.isActive("strike"),
      code: current.isActive("code"),
      bulletList: current.isActive("bulletList"),
      orderedList: current.isActive("orderedList"),
      taskList: current.isActive("taskList"),
      blockquote: current.isActive("blockquote"),
      codeBlock: current.isActive("codeBlock"),
      link: current.isActive("link"),
      table: current.isActive("table"),
      heading: ([1, 2, 3] as const).find((level) => current.isActive("heading", { level })) ?? 0,
      canUndo: current.can().chain().undo().run(),
      canRedo: current.can().chain().redo().run(),
    }),
  });

  const divider = <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-border" />;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-0.5 border-b bg-muted/30 p-1.5" role="toolbar" aria-label="Note formatting">
      <ToolbarButton label="Undo" disabled={!state.canUndo} onClick={() => editor.chain().focus().undo().run()}><Undo2 className="size-3.5" /></ToolbarButton>
      <ToolbarButton label="Redo" disabled={!state.canRedo} onClick={() => editor.chain().focus().redo().run()}><Redo2 className="size-3.5" /></ToolbarButton>
      {divider}
      <select
        aria-label="Text style"
        value={state.heading ? String(state.heading) : "paragraph"}
        onChange={(event) => {
          const value = event.target.value;
          if (value === "paragraph") editor.chain().focus().setParagraph().run();
          else editor.chain().focus().setHeading({ level: Number(value) as 1 | 2 | 3 }).run();
        }}
        className="h-7 max-w-28 rounded border bg-background px-1.5 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <option value="paragraph">Paragraph</option>
        <option value="1">Heading 1</option>
        <option value="2">Heading 2</option>
        <option value="3">Heading 3</option>
      </select>
      {divider}
      <ToolbarButton label="Bold" active={state.bold} onClick={() => editor.chain().focus().toggleBold().run()}><Bold className="size-3.5" /></ToolbarButton>
      <ToolbarButton label="Italic" active={state.italic} onClick={() => editor.chain().focus().toggleItalic().run()}><Italic className="size-3.5" /></ToolbarButton>
      <ToolbarButton label="Underline" active={state.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}><Underline className="size-3.5" /></ToolbarButton>
      <ToolbarButton label="Strikethrough" active={state.strike} onClick={() => editor.chain().focus().toggleStrike().run()}><Strikethrough className="size-3.5" /></ToolbarButton>
      <ToolbarButton label="Inline code" active={state.code} onClick={() => editor.chain().focus().toggleCode().run()}><Code className="size-3.5" /></ToolbarButton>
      {divider}
      <ToolbarButton label="Bullet list" active={state.bulletList} onClick={() => editor.chain().focus().toggleBulletList().run()}><List className="size-3.5" /></ToolbarButton>
      <ToolbarButton label="Ordered list" active={state.orderedList} onClick={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="size-3.5" /></ToolbarButton>
      <ToolbarButton label="Checklist" active={state.taskList} onClick={() => editor.chain().focus().toggleTaskList().run()}><ListChecks className="size-3.5" /></ToolbarButton>
      <ToolbarButton label="Blockquote" active={state.blockquote} onClick={() => editor.chain().focus().toggleBlockquote().run()}><Quote className="size-3.5" /></ToolbarButton>
      <ToolbarButton label="Code block" active={state.codeBlock} onClick={() => editor.chain().focus().toggleCodeBlock().run()}><Code2 className="size-3.5" /></ToolbarButton>
      <ToolbarButton label="Horizontal rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}><Minus className="size-3.5" /></ToolbarButton>
      <LinkControl editor={editor} active={state.link} />
      <TableControl editor={editor} active={state.table} />
    </div>
  );
}

export function MarkdownEditor({
  markdown,
  onChange,
  placeholder = "Start writing.",
  readOnly = false,
}: {
  markdown: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: createNoteEditorExtensions(placeholder),
    content: prepareNoteMarkdown(markdown),
    contentType: "markdown",
    editorProps: {
      attributes: {
        class: "tiptap note-editor-content prose prose-sm max-w-none px-4 py-4 outline-none dark:prose-invert min-h-[300px]",
      },
      handlePaste: (_view, event) => Boolean(event.clipboardData?.files.length),
      handleDrop: (_view, event) => Boolean(event.dataTransfer?.files.length),
    },
    editable: !readOnly,
    onUpdate: ({ editor: current }) => { if (!readOnly) onChange(serializeNoteMarkdown(current)); },
  });

  return (
    <div className="note-tiptap w-full min-w-0 overflow-hidden rounded-lg border bg-card shadow-sm">
      {!readOnly && (editor ? <EditorToolbar editor={editor} /> : <div className="h-10 animate-pulse border-b bg-muted/30" />)}
      <EditorContent editor={editor} />
    </div>
  );
}

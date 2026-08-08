import type { Editor, JSONContent } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import Placeholder from "@tiptap/extension-placeholder";
import { TableKit } from "@tiptap/extension-table";
import { Markdown } from "@tiptap/markdown";
import StarterKit from "@tiptap/starter-kit";

const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);

export function isSafeNoteLink(href: string): boolean {
  try {
    return SAFE_LINK_PROTOCOLS.has(new URL(href).protocol);
  } catch {
    return false;
  }
}

export function prepareNoteMarkdown(markdown: string): string {
  return markdown.replace(/<u>([\s\S]*?)<\/u>/gi, "++$1++");
}

export function sanitizeNoteDocument(node: JSONContent): JSONContent {
  return {
    ...node,
    ...(node.marks
      ? {
          marks: node.marks.filter((mark) => (
            mark.type !== "link" || isSafeNoteLink(String(mark.attrs?.href ?? ""))
          )),
        }
      : {}),
    ...(node.content ? { content: node.content.map(sanitizeNoteDocument) } : {}),
  };
}

export function createNoteEditorExtensions(placeholder = "Start writing.") {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        defaultProtocol: "https",
        openOnClick: false,
        isAllowedUri: isSafeNoteLink,
        HTMLAttributes: {
          target: "_blank",
          rel: "noopener noreferrer",
        },
      },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    TableKit.configure({ table: { resizable: false } }),
    Placeholder.configure({ placeholder }),
    Markdown.configure({
      markedOptions: { gfm: true, breaks: false },
    }),
  ];
}

export function serializeNoteMarkdown(editor: Editor): string {
  if (!editor.markdown) throw new Error("Markdown support is unavailable");
  return editor.markdown.serialize(sanitizeNoteDocument(editor.getJSON()));
}

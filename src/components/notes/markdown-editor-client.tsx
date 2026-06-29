"use client";
import { useState } from "react";
import {
  MDXEditor,
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  ListsToggle,
  CreateLink,
  InsertThematicBreak,
} from "@mdxeditor/editor";

export default function MarkdownEditorClient({
  markdown,
  onChange,
  placeholder,
}: {
  markdown: string;
  onChange: (md: string) => void;
  placeholder?: string;
}) {
  // Capture the initial markdown once. The editor owns its state from then on.
  // The parent uses `key={noteId}` to remount when switching notes.
  const [initialMarkdown] = useState(() => markdown);
  return (
    <MDXEditor
      markdown={initialMarkdown}
      onChange={onChange}
      placeholder={placeholder ?? "Start writing…"}
      contentEditableClassName="prose prose-sm max-w-none px-0 py-4 outline-none dark:prose-invert min-h-[300px]"
      className="mdx-flowboard w-full min-w-0"
      plugins={[
        headingsPlugin(),
        listsPlugin(),
        quotePlugin(),
        thematicBreakPlugin(),
        linkPlugin(),
        linkDialogPlugin(),
        markdownShortcutPlugin(),
        toolbarPlugin({
          toolbarContents: () => (
            <>
              <UndoRedo />
              <BoldItalicUnderlineToggles />
              <BlockTypeSelect />
              <ListsToggle />
              <CreateLink />
              <InsertThematicBreak />
            </>
          ),
        }),
      ]}
    />
  );
}

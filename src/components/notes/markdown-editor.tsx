"use client";
import dynamic from "next/dynamic";
import "@mdxeditor/editor/style.css";

// MDXEditor cannot SSR — wrap it in a client-only dynamic import.
const Editor = dynamic(() => import("./markdown-editor-client"), {
  ssr: false,
  loading: () => (
    <div className="mt-4 h-64 animate-pulse rounded border border-border/40 bg-muted/30" />
  ),
});

export function MarkdownEditor(props: { markdown: string; onChange: (md: string) => void; placeholder?: string }) {
  return <Editor {...props} />;
}

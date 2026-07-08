import assert from "node:assert/strict";
import { test } from "node:test";
import { findUncheckedNoteTasks, splitNoteMarkdown } from "../src/lib/note-markdown";

test("NOTES-TIPTAP-001: title and Markdown body remain separate for saving", () => {
  assert.deepEqual(splitNoteMarkdown("# Launch plan\n\nBody text."), {
    title: "Launch plan",
    body: "Body text.",
  });
});

test("NOTES-TIPTAP-001: task extraction still finds supported checklist syntax", () => {
  assert.deepEqual(findUncheckedNoteTasks([
    "- [ ] First task",
    "  * [ ] Nested task",
    "- [x] Already done",
    "- ordinary bullet",
  ].join("\n")), [
    { lineIndex: 0, indent: "", title: "First task" },
    { lineIndex: 1, indent: "  ", title: "Nested task" },
  ]);
});

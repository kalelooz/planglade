import assert from "node:assert/strict";
import { test } from "node:test";
import { Editor } from "@tiptap/core";
import {
  createNoteEditorExtensions,
  prepareNoteMarkdown,
  sanitizeNoteDocument,
  serializeNoteMarkdown,
} from "../src/components/notes/markdown-editor-config";

function openMarkdown(markdown: string) {
  const prepared = prepareNoteMarkdown(markdown);
  return new Editor({
    extensions: createNoteEditorExtensions(),
    content: prepared || { type: "doc", content: [{ type: "paragraph" }] },
    ...(prepared ? { contentType: "markdown" as const } : {}),
  });
}

function assertSemanticRoundTrip(markdown: string) {
  const editor = openMarkdown(markdown);
  const before = sanitizeNoteDocument(editor.getJSON());
  const serialized = serializeNoteMarkdown(editor);
  editor.destroy();

  const reopened = openMarkdown(serialized);
  const after = sanitizeNoteDocument(reopened.getJSON());
  reopened.destroy();

  assert.deepEqual(after, before);
}

const cases = {
  "plain paragraphs": "A plain paragraph.",
  headings: "# Title\n\n## Section\n\n### Detail",
  "inline formatting": "**bold** *italic* ++underline++ ~~strike~~ and `inline code`",
  "legacy underline HTML": "A <u>legacy underline</u> remains underlined.",
  "bullet and ordered lists": "- One\n- Two\n\n1. First\n2. Second",
  "nested lists": "- Parent\n  - Child\n    1. Nested ordered",
  checklists: "- [ ] Open item\n- [x] Finished item",
  links: "[Secure](https://example.com) and [mail](mailto:hello@example.com)",
  blockquotes: "> Quoted text\n>\n> Second paragraph",
  "horizontal rules": "Before\n\n---\n\nAfter",
  "fenced code blocks": "```ts\nconst safe = true;\n```",
  tables: "| Name | State |\n| --- | --- |\n| PlanGlade | Ready |",
  "empty notes": "",
  "special characters": "Ampersand & brackets \\[text\\], emoji 🌿, and © symbols.",
  "multiple consecutive paragraphs": "First.\n\nSecond.\n\nThird.",
};

for (const [name, markdown] of Object.entries(cases)) {
  test(`NOTES-TIPTAP-001: ${name} is semantically stable`, () => {
    assertSemanticRoundTrip(markdown);
  });
}

test("NOTES-TIPTAP-001: unsafe HTML and link protocols cannot survive as executable content", () => {
  const editor = openMarkdown([
    '<script>alert("x")</script>',
    '<img src=x onerror=alert("x")>',
    "[unsafe](javascript:alert(1))",
    "[secure](https://example.com)",
  ].join("\n\n"));

  const document = JSON.stringify(sanitizeNoteDocument(editor.getJSON()));
  const markdown = serializeNoteMarkdown(editor);
  editor.destroy();

  assert.doesNotMatch(document, /"type":"script"|"type":"image"|"href":"javascript:/i);
  assert.doesNotMatch(markdown, /<script|<img/i);
  assert.match(markdown, /&lt;script&gt;/i);
  assert.doesNotMatch(markdown, /javascript:/i);
  assert.match(markdown, /\[secure\]\(https:\/\/example\.com\)/);
});

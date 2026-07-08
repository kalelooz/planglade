import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";

const root = process.cwd();

test("NOTES-TIPTAP-001: Notes uses Tiptap with the approved compact feature set", async () => {
  const source = await readFile(path.join(root, "src/components/notes/markdown-editor.tsx"), "utf8");

  assert.match(source, /useEditor/);
  assert.match(source, /EditorContent/);
  for (const command of [
    "toggleBold",
    "toggleItalic",
    "toggleUnderline",
    "toggleStrike",
    "toggleCode",
    "toggleBulletList",
    "toggleOrderedList",
    "toggleTaskList",
    "toggleBlockquote",
    "toggleCodeBlock",
    "setHorizontalRule",
    "insertTable",
    "undo",
    "redo",
  ]) assert.match(source, new RegExp(command));

  assert.match(source, /flex-wrap/);
  assert.match(source, /aria-pressed/);
  assert.match(source, /handlePaste/);
  assert.match(source, /handleDrop/);
  assert.doesNotMatch(source, /dangerouslySetInnerHTML|MDXEditor/);
});

test("NOTES-TIPTAP-001: dependency and technical docs record the completed editor decision", async () => {
  const packageJson = await readFile(path.join(root, "package.json"), "utf8");
  const technical = await readFile(path.join(root, "TECHNICAL.md"), "utf8");
  const execution = await readFile(path.join(root, "EXECUTION.md"), "utf8");

  assert.doesNotMatch(packageJson, /@mdxeditor\/editor/);
  assert.match(packageJson, /@tiptap\/react/);
  assert.match(technical, /Tiptap.*Markdown-backed/i);
  assert.match(execution, /NOTES-TIPTAP-001.*Done/i);
});

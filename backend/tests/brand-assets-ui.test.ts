import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8");
}

async function findHtmlFiles(dir: string): Promise<string[]> {
  const ignored = new Set([".git", ".next", "node_modules", "output", "artifacts", "external"]);
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return ignored.has(entry.name) ? [] : findHtmlFiles(fullPath);
      }
      return entry.isFile() && entry.name.endsWith(".html") ? [fullPath] : [];
    }),
  );

  return files.flat();
}

test("BRAND-GLOBAL-POLISH-002: required public brand assets exist", async () => {
  for (const filePath of [
    "public/brand/logo-mark.svg",
    "public/brand/logo.svg",
    "public/brand/wordmark.svg",
    "public/brand/og-image.png",
    "src/app/favicon.ico",
    "src/app/icon.png",
    "src/app/apple-icon.png",
  ]) {
    const fileStat = await stat(path.join(root, filePath));
    assert.ok(fileStat.size > 0, `${filePath} should not be empty`);
  }
});

test("BRAND-GLOBAL-POLISH-002: PG mark is the shared app and landing brand", async () => {
  const [component, shell, landing, showcase] = await Promise.all([
    readProjectFile("src/components/brand/plan-glade-mark.tsx"),
    readProjectFile("src/components/lovable/shell.tsx"),
    readProjectFile("src/app/landing/page.tsx"),
    readProjectFile("src/app/landing/product-showcase.tsx"),
  ]);

  assert.match(component, /PG/);
  assert.match(component, /text-\[12px\]/);
  assert.match(component, /font-extrabold/);
  assert.match(shell, /PlanGladeMark/);
  assert.match(landing, /<PlanGladeMark \/>/);
  assert.match(showcase, /<PlanGladeMark \/>/);

  const landingLogo = landing.match(/function Logo\(\)[\s\S]*?\n}\n/)?.[0] ?? "";
  const showcaseBrand = showcase.match(/function ShowcaseSidebar\(\)[\s\S]*?<nav/)?.[0] ?? "";
  assert.doesNotMatch(landingLogo, /ListTodo|TreePine/);
  assert.doesNotMatch(showcaseBrand, /ListTodo|TreePine/);
});

test("BRAND-GLOBAL-POLISH-002: public logos are PG and not the old animated glyph", async () => {
  const [publicLogo, brandLogo, mark] = await Promise.all([
    readProjectFile("public/logo.svg"),
    readProjectFile("public/brand/logo.svg"),
    readProjectFile("public/brand/logo-mark.svg"),
  ]);

  for (const source of [publicLogo, brandLogo, mark]) {
    assert.match(source, /PG/);
    assert.match(source, /font-size="40"/);
    assert.match(source, /font-weight="850"/);
    assert.doesNotMatch(source, /z-breathe|@keyframes|animation|TreePine|forest|campfire|mountain|leaf/i);
  }
});

test("BRAND-GLOBAL-POLISH-002: metadata keeps current icon and social assets", async () => {
  const layout = await readProjectFile("src/app/layout.tsx");

  assert.match(layout, /\/favicon\.ico/);
  assert.match(layout, /\/icon\.png/);
  assert.match(layout, /\/apple-icon\.png/);
  assert.match(layout, /\/brand\/logo-mark\.svg/);
  assert.match(layout, /\/brand\/og-image\.png/);
});

test("BRAND-GLOBAL-POLISH-002: static HTML files do not reference old logo assets", async () => {
  const htmlFiles = await findHtmlFiles(root);

  for (const filePath of htmlFiles) {
    const source = await readFile(filePath, "utf8");
    assert.doesNotMatch(source, /TreePine|z-breathe|\/logo\.svg|logo\.svg/i, filePath);
  }
});

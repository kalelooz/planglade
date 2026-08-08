import assert from "node:assert/strict";
import test from "node:test";

import {
  readExplicitLocalThemePreference,
  resolveHydratedTheme,
  shouldInitializeThemeFromServer,
} from "../src/lib/theme-preference";

function storageWith(value: string | null) {
  return { getItem: () => value };
}

test("clean devices remain light even when the operating system is dark", () => {
  assert.equal(readExplicitLocalThemePreference(storageWith(null)), null);
  assert.equal(resolveHydratedTheme(null, "light"), "light");
});

test("explicit local preferences outrank hydrated store values", () => {
  assert.equal(resolveHydratedTheme("dark", "light"), "dark");
  assert.equal(resolveHydratedTheme("light", "dark"), "light");
  assert.equal(resolveHydratedTheme("system", "light"), "system");
});

test("invalid local theme values are ignored", () => {
  assert.equal(readExplicitLocalThemePreference(storageWith("sepia")), null);
});

test("a delayed server response cannot replace a newer local selection", () => {
  assert.equal(shouldInitializeThemeFromServer(0, 1, null), false);
  assert.equal(shouldInitializeThemeFromServer(0, 0, "dark"), false);
  assert.equal(shouldInitializeThemeFromServer(0, 0, null), true);
});

test("real and demo settings use the shared synchronization contract", async () => {
  const { readFile } = await import("node:fs/promises");
  const [realSettings, demoSettings] = await Promise.all([
    readFile("src/app/app/settings/page.tsx", "utf8"),
    readFile("src/app/demo/settings/page.tsx", "utf8"),
  ]);

  assert.match(realSettings, /useThemePreference\(\)/);
  assert.match(demoSettings, /useThemePreference\(\)/);
  assert.doesNotMatch(realSettings, /from "next-themes"/);
  assert.doesNotMatch(demoSettings, /from "next-themes"/);
});

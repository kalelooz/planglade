import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

test("shared dropdown menus use the liquid reveal with a reduced-motion fallback", async () => {
  const [component, styles] = await Promise.all([
    readFile(path.join(process.cwd(), "src/components/ui/dropdown-menu.tsx"), "utf8"),
    readFile(path.join(process.cwd(), "src/app/globals.css"), "utf8"),
  ])

  assert.match(component, /"lov-liquid-menu bg-popover/)
  assert.match(component, /lov-liquid-menu-item/)
  assert.doesNotMatch(component, /data-\[state=open\]:zoom-in-95/)
  assert.match(styles, /lov-liquid-menu-open 190ms cubic-bezier\(0\.23, 1, 0\.32, 1\)/)
  assert.match(styles, /lov-liquid-menu-close 150ms cubic-bezier\(0\.25, 0\.46, 0\.45, 0\.94\)/)
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/)
  assert.match(styles, /clip-path: inset\(0 0 calc\(100% - 0\.75rem\) 0 round 0\.5rem\)/)
})

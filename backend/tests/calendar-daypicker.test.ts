import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = process.cwd()

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

test("Calendar DayPicker classNames target the v9 month_grid key, not the removed table key", async () => {
  const source = await readProjectFile("src/components/ui/calendar.tsx")

  // react-day-picker@9 renamed UI.table -> UI.MonthGrid ("month_grid").
  // The MonthGrid component renders the <table>, so the border-collapse
  // styling must be keyed on month_grid to take effect.
  assert.match(source, /month_grid:\s*cn\("w-full border-collapse"/)
  assert.doesNotMatch(source, /^\s*table:\s*"w-full border-collapse"/m)
})

test("Calendar day rounding uses type-based selectors so week-number cells do not shadow the range start", async () => {
  const source = await readProjectFile("src/components/ui/calendar.tsx")

  // With showWeekNumber on, a <th> week-number cell precedes the day <td>s in
  // each row. :first-child would target that <th>, so the left cap on a
  // range-start day landing on the first day of the week would never apply.
  // :first-of-type / :last-of-type operate per element type, so they keep
  // resolving to the first/last <td> day cell even when week numbers are shown.
  assert.match(source, /\[&:first-of-type\[data-selected=true\]_button\]:rounded-l-md/)
  assert.match(source, /\[&:last-of-type\[data-selected=true\]_button\]:rounded-r-md/)
  assert.doesNotMatch(source, /first-child\[data-selected=true\]_button\]:rounded-l-md/)
  assert.doesNotMatch(source, /last-child\[data-selected=true\]_button\]:rounded-r-md/)

  // The custom WeekNumber cell must be a <th> so its element type differs from
  // the day <td> cells; otherwise :first-of-type could not distinguish them.
  const weekNumberSource =
    source.match(/WeekNumber:[\s\S]*?\n\s*\},/)?.[0] ?? ""
  assert.match(weekNumberSource, /<th \{\.\.\.props\}>/)
  assert.doesNotMatch(weekNumberSource, /<td \{\.\.\.props\}>/)
})

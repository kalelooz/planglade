import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"
import { NextRequest } from "next/server"

import { db } from "../src/lib/db"
import { GET as getSettings, PUT as putSettings } from "../src/app/api/settings/route"
import { normalizeAppearanceSettings, resolvePriorityDisplayStyle } from "../src/lib/appearance-defaults"

const root = process.cwd()
const originalAuthMode = process.env.FLOWBOARD_AUTH_MODE
const originalWorkspaceFindUnique = db.workspace.findUnique
const originalWorkspaceUpdate = db.workspace.update
const originalWorkspaceMemberFindUnique = db.workspaceMember.findUnique
const originalUserSettingsFindUnique = db.userSettings.findUnique
const originalUserSettingsUpsert = db.userSettings.upsert

async function readProjectFile(filePath: string) {
  return readFile(path.join(root, filePath), "utf8")
}

async function runWithSettingsMocks(fn: () => Promise<void>) {
  process.env.FLOWBOARD_AUTH_MODE = "dev"
  try {
    await fn()
  } finally {
    process.env.FLOWBOARD_AUTH_MODE = originalAuthMode
    ;(db.workspace as typeof db.workspace).findUnique = originalWorkspaceFindUnique
    ;(db.workspace as typeof db.workspace).update = originalWorkspaceUpdate
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = originalWorkspaceMemberFindUnique
    ;(db.userSettings as typeof db.userSettings).findUnique = originalUserSettingsFindUnique
    ;(db.userSettings as typeof db.userSettings).upsert = originalUserSettingsUpsert
  }
}

function mockSettingsAccess(taskPriorityDisplayStyle: string | null | undefined) {
  ;(db.workspace as typeof db.workspace).findUnique = ((async (args: unknown) => {
    const select = (args as { select?: Record<string, boolean> }).select
    if (select?.taskPriorityDisplayStyle && !select?.ownerId) {
      if (taskPriorityDisplayStyle === undefined) return {}
      return { taskPriorityDisplayStyle }
    }
    return {
      id: "workspace-1",
      ownerId: "actor-1",
      slug: "acme",
      name: "Acme",
      taskPriorityDisplayStyle,
    }
  }) as unknown) as typeof db.workspace.findUnique

  ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
    userId: "actor-1",
    role: "OWNER",
  })) as unknown) as typeof db.workspaceMember.findUnique
}

test("Settings shows black accent and labeled priority style options", async () => {
  const settingsPage = await readProjectFile("src/app/app/settings/page.tsx")

  assert.match(settingsPage, /label: "Black"/)
  assert.match(settingsPage, /oklch\(0\.21 0\.006 286\)/)
  assert.match(settingsPage, /Priority display/)
  assert.match(settingsPage, /title: "Text"/)
  assert.match(settingsPage, /title: "Dots"/)
  assert.match(settingsPage, /title: "Badge"/)
  assert.match(settingsPage, /title: "Arrows"/)
  assert.match(settingsPage, /RadioGroupPrimitive\.Root/)
  assert.match(settingsPage, /RadioGroupPrimitive\.Item/)
  assert.match(settingsPage, /aria-label="Priority display style"/)
  assert.match(settingsPage, /aria-label=\{`\$\{opt\.title\} priority display`\}/)
  assert.match(settingsPage, /<span className="min-w-0 truncate font-medium">\{opt\.title\}<\/span>/)
  assert.match(settingsPage, /PriorityStyleOptionExample style=\{opt\.key\}/)
  assert.match(settingsPage, /data-priority-preview="live"/)
  assert.match(settingsPage, /persistUserSettings\(\{ taskPriorityDisplayStyle: priorityDisplayStyle \}\)/)
  assert.doesNotMatch(settingsPage, /PriorityDisplayPreview/)
  assert.doesNotMatch(settingsPage, /data-priority-option-preview/)
  assert.doesNotMatch(settingsPage, /text\.env/)
})

test("Settings Appearance preview stays static, aligned, and free of leaked control labels", async () => {
  const settingsPage = await readProjectFile("src/app/app/settings/page.tsx")

  assert.match(settingsPage, /data-priority-preview="live"/)
  assert.match(settingsPage, /Prepare launch checklist/)
  assert.match(settingsPage, /Review project notes/)
  assert.match(settingsPage, /Clean up inbox captures/)
  assert.match(settingsPage, /title: "Prepare launch checklist", priority: "High"/)
  assert.match(settingsPage, /title: "Review project notes", priority: "Medium"/)
  assert.match(settingsPage, /title: "Clean up inbox captures", priority: "Low"/)
  assert.match(settingsPage, />Task row sample</)
  assert.match(settingsPage, />High \/ Medium \/ Low</)
  assert.match(settingsPage, /grid-cols-\[auto_auto_minmax\(0,1fr\)_auto\]/)
  assert.match(settingsPage, /PreviewStaticMeta/)
  assert.doesNotMatch(settingsPage, /Primary action/)
  assert.doesNotMatch(settingsPage, /Priority examples/)
  assert.doesNotMatch(settingsPage, />Preview</)
  assert.doesNotMatch(settingsPage, />How task rows will read\.</)
  assert.doesNotMatch(settingsPage, /workItems\.slice/)
  assert.doesNotMatch(settingsPage, /\bhi\b/)
  assert.doesNotMatch(settingsPage, /Untitled task/)
  assert.doesNotMatch(settingsPage, /Menu preview/)
  assert.doesNotMatch(settingsPage, />Selected</)
  assert.doesNotMatch(settingsPage, />SELECT</)
})

test("Settings priority style picker stays compact and connected to the preview", async () => {
  const settingsPage = await readProjectFile("src/app/app/settings/page.tsx")
  const priorityBlock = settingsPage.slice(
    settingsPage.indexOf('<Field label="Priority display"'),
    settingsPage.indexOf('{section === "Data"')
  )
  const priorityOptionsBlock = settingsPage.slice(
    settingsPage.indexOf("const PRIORITY_DISPLAY_OPTIONS"),
    settingsPage.indexOf("const STATIC_PREVIEW_TASKS")
  )

  assert.match(settingsPage, /Field label="Priority display"/)
  assert.match(settingsPage, /data-priority-style-control="compact-options"/)
  assert.match(settingsPage, /grid w-full max-w-xl grid-cols-2 gap-2/)
  assert.match(settingsPage, /h-14/)
  assert.match(settingsPage, /border border-zinc-200\/80 bg-white px-3 py-2 text-left text-xs/)
  assert.match(settingsPage, /data-\[state=checked\]:border-zinc-900/)
  assert.match(settingsPage, /data-\[state=checked\]:bg-zinc-50/)
  assert.match(settingsPage, /data-\[state=checked\]:ring-zinc-900\/10/)
  assert.match(settingsPage, /PriorityStyleOptionExample/)
  assert.match(settingsPage, /data-priority-picker-preview="connected"/)
  assert.match(settingsPage, /max-w-xl overflow-hidden rounded-md border border-zinc-200\/80 bg-white/)
  assert.match(settingsPage, /mt-6 max-w-4xl space-y-4/)
  assert.match(settingsPage, /grid grid-cols-1 gap-3 border-b pb-5 sm:grid-cols-\[180px_1fr\] sm:gap-6/)
  assert.match(settingsPage, /text-\[10px\]/)
  assert.doesNotMatch(settingsPage, /Field label="Live preview"/)
  assert.doesNotMatch(settingsPage, /min-h-24|min-h-32/)
  assert.doesNotMatch(settingsPage, /h-20|h-24|min-h-\[96px\]|min-h-\[120px\]/)
  assert.doesNotMatch(settingsPage, /xl:grid-cols-4/)
  assert.doesNotMatch(settingsPage, /rounded-xl|rounded-2xl/)
  assert.doesNotMatch(settingsPage, /ring-2 ring-zinc-900|border-2 border-zinc-900/)
  assert.doesNotMatch(priorityBlock, /overflow-x-auto|whitespace-nowrap/)
  assert.doesNotMatch(priorityBlock, /flex-col items-start rounded-md border bg-card px-3 py-3/)
  assert.doesNotMatch(priorityBlock, /Color dots only|P1 \/ P2 \/ P3|Up \/ side \/ down/)
  assert.doesNotMatch(priorityOptionsBlock, /description:/)
  assert.doesNotMatch(priorityOptionsBlock, /subtitle:/)
})

test("Priority display style defaults to Badge and allows only text, dot, badge, arrow", async () => {
  const defaults = await readProjectFile("src/lib/appearance-defaults.ts")
  const contracts = await readProjectFile("src/lib/contracts.ts")
  const store = await readProjectFile("src/lib/store.ts")
  const schema = await readProjectFile("prisma/schema.prisma")
  const sessionClient = await readProjectFile("src/lib/server-session-client.ts")
  const indicator = await readProjectFile("src/components/lovable/priority-indicator.tsx")
  const authSession = await readProjectFile("src/app/api/auth/session/route.ts")
  const onboarding = await readProjectFile("src/app/api/workspace/onboarding/route.ts")

  assert.match(defaults, /PRIORITY_DISPLAY_STYLES = \["text", "dot", "badge", "arrow"\] as const/)
  assert.match(defaults, /DEFAULT_PRIORITY_DISPLAY_STYLE: PriorityDisplayStyle = "badge"/)
  assert.match(schema, /taskPriorityDisplayStyle\s+String\s+@default\("badge"\)/)
  assert.match(contracts, /priorityDisplayStyleSchema = z\.enum\(PRIORITY_DISPLAY_STYLES\)/)
  assert.match(contracts, /export \{ DEFAULT_PRIORITY_DISPLAY_STYLE, normalizeAppearanceSettings, resolvePriorityDisplayStyle, type PriorityDisplayStyle \}/)
  assert.match(store, /type PriorityDisplayStyle \} from "\.\/appearance-defaults"/)
  assert.match(store, /normalizeAppearanceSettings/)
  assert.match(indicator, /style \?\? settingStyle \?\? DEFAULT_PRIORITY_DISPLAY_STYLE/)
  assert.match(sessionClient, /taskPriorityDisplayStyle\?: PriorityDisplayStyle/)
  assert.match(authSession, /taskPriorityDisplayStyle: DEFAULT_PRIORITY_DISPLAY_STYLE/)
  assert.match(onboarding, /taskPriorityDisplayStyle: DEFAULT_PRIORITY_DISPLAY_STYLE/)
})

test("Priority display resolver falls back only for missing, null, or invalid values", () => {
  assert.equal(resolvePriorityDisplayStyle(undefined), "badge")
  assert.equal(resolvePriorityDisplayStyle(null), "badge")
  assert.equal(resolvePriorityDisplayStyle(""), "badge")
  assert.equal(resolvePriorityDisplayStyle("dots"), "badge")
  assert.equal(resolvePriorityDisplayStyle("arrows"), "badge")
  assert.equal(resolvePriorityDisplayStyle("text"), "text")
  assert.equal(resolvePriorityDisplayStyle("dot"), "dot")
  assert.equal(resolvePriorityDisplayStyle("badge"), "badge")
  assert.equal(resolvePriorityDisplayStyle("arrow"), "arrow")
})

test("Appearance settings normalization preserves explicit priority choices", () => {
  assert.equal(normalizeAppearanceSettings(undefined).priorityDisplayStyle, "badge")
  assert.equal(normalizeAppearanceSettings(null).priorityDisplayStyle, "badge")
  assert.equal(normalizeAppearanceSettings({}).priorityDisplayStyle, "badge")
  assert.equal(normalizeAppearanceSettings({ priorityDisplayStyle: null }).priorityDisplayStyle, "badge")
  assert.equal(normalizeAppearanceSettings({ priorityDisplayStyle: "invalid" }).priorityDisplayStyle, "badge")
  assert.equal(normalizeAppearanceSettings({ priorityDisplayStyle: "text" }).priorityDisplayStyle, "text")
  assert.equal(normalizeAppearanceSettings({ priorityDisplayStyle: "dot" }).priorityDisplayStyle, "dot")
  assert.equal(normalizeAppearanceSettings({ priorityDisplayStyle: "badge" }).priorityDisplayStyle, "badge")
  assert.equal(normalizeAppearanceSettings({ priorityDisplayStyle: "arrow" }).priorityDisplayStyle, "arrow")
})

test("PriorityIndicator is consumed by Tasks list, Board, Drawer, and Project Detail", async () => {
  const files = [
    "src/components/lovable/work-item-row.tsx",
    "src/app/board/board-page-content.tsx",
    "src/components/lovable/task-drawer.tsx",
    "src/app/app/projects/projects-page-content.tsx",
  ]

  for (const file of files) {
    const source = await readProjectFile(file)
    assert.match(source, /PriorityIndicator/, `${file} must use PriorityIndicator`)
  }

  const listRow = await readProjectFile("src/components/lovable/work-item-row.tsx")
  const board = await readProjectFile("src/app/board/board-page-content.tsx")
  const drawer = await readProjectFile("src/components/lovable/task-drawer.tsx")
  const home = await readProjectFile("src/app/app/page.tsx")
  const projectDetail = await readProjectFile("src/app/app/projects/projects-page-content.tsx")

  assert.doesNotMatch(listRow, /PriorityIcon/)
  assert.doesNotMatch(board, /PriorityIcon/)
  assert.doesNotMatch(drawer, /PriorityIcon/)
  assert.doesNotMatch(projectDetail, /<PriorityIcon/)
  assert.match(home, /<Flag aria-label=\{`\$\{item\.priority\} priority`\}/)
})

test("PriorityIndicator supports exactly one colored priority style at a time", async () => {
  const indicator = await readProjectFile("src/components/lovable/priority-indicator.tsx")

  assert.match(indicator, /effective === "dot"/)
  assert.match(indicator, /effective === "badge"/)
  assert.match(indicator, /effective === "arrow"/)
  assert.match(indicator, /ArrowUp/)
  assert.match(indicator, /ArrowRight/)
  assert.match(indicator, /ArrowDown/)
  assert.match(indicator, /text-red-700/)
  assert.match(indicator, /bg-amber-500/)
  assert.match(indicator, /border-sky-300/)
  const dotBranch = indicator.slice(indicator.indexOf('effective === "dot"'), indicator.indexOf('effective === "badge"'))
  const badgeBranch = indicator.slice(indicator.indexOf('effective === "badge"'), indicator.indexOf('effective === "arrow"'))
  const arrowBranch = indicator.slice(indicator.indexOf('effective === "arrow"'), indicator.indexOf("  return ("))
  assert.doesNotMatch(dotBranch, />\s*\{label\}\s*</, "dot style must not render visible text")
  assert.doesNotMatch(dotBranch, /PRIORITY_SHORT_LABEL/, "dot style must not render badges")
  assert.doesNotMatch(badgeBranch, /<Icon/, "badge style must not render arrows")
  assert.doesNotMatch(arrowBranch, /PRIORITY_SHORT_LABEL|>\s*\{label\}\s*</, "arrow style must not render visible badge or text labels")
})

test("Settings route falls back to Badge when workspace priority display style is missing", async () => {
  await runWithSettingsMocks(async () => {
    mockSettingsAccess(undefined)
    ;(db.userSettings as typeof db.userSettings).findUnique = ((async () => null) as unknown) as typeof db.userSettings.findUnique

    const request = new NextRequest(
      "http://localhost/api/settings?workspaceId=workspace-1&userId=actor-1",
      { headers: { "x-flowboard-user-id": "actor-1" } }
    )

    const response = await getSettings(request)
    const payload = (await response.json()) as {
      workspace?: { taskPriorityDisplayStyle?: string }
    }

    assert.equal(response.status, 200)
    assert.equal(payload.workspace?.taskPriorityDisplayStyle, "badge")
  })
})

test("Settings route falls back to Badge when workspace priority display style is null", async () => {
  await runWithSettingsMocks(async () => {
    mockSettingsAccess(null)
    ;(db.userSettings as typeof db.userSettings).findUnique = ((async () => null) as unknown) as typeof db.userSettings.findUnique

    const request = new NextRequest(
      "http://localhost/api/settings?workspaceId=workspace-1&userId=actor-1",
      { headers: { "x-flowboard-user-id": "actor-1" } }
    )

    const response = await getSettings(request)
    const payload = (await response.json()) as {
      workspace?: { taskPriorityDisplayStyle?: string }
    }

    assert.equal(response.status, 200)
    assert.equal(payload.workspace?.taskPriorityDisplayStyle, "badge")
  })
})

test("Settings route preserves an explicit Text priority display style", async () => {
  await runWithSettingsMocks(async () => {
    mockSettingsAccess("text")
    ;(db.userSettings as typeof db.userSettings).findUnique = ((async () => null) as unknown) as typeof db.userSettings.findUnique

    const request = new NextRequest(
      "http://localhost/api/settings?workspaceId=workspace-1&userId=actor-1",
      { headers: { "x-flowboard-user-id": "actor-1" } }
    )

    const response = await getSettings(request)
    const payload = (await response.json()) as {
      workspace?: { taskPriorityDisplayStyle?: string }
    }

    assert.equal(response.status, 200)
    assert.equal(payload.workspace?.taskPriorityDisplayStyle, "text")
  })
})

test("Settings route preserves every explicit priority display style", async () => {
  for (const style of ["text", "dot", "badge", "arrow"]) {
    await runWithSettingsMocks(async () => {
      mockSettingsAccess(style)
      ;(db.userSettings as typeof db.userSettings).findUnique = ((async () => null) as unknown) as typeof db.userSettings.findUnique

      const request = new NextRequest(
        "http://localhost/api/settings?workspaceId=workspace-1&userId=actor-1",
        { headers: { "x-flowboard-user-id": "actor-1" } }
      )

      const response = await getSettings(request)
      const payload = (await response.json()) as {
        workspace?: { taskPriorityDisplayStyle?: string }
      }

      assert.equal(response.status, 200)
      assert.equal(payload.workspace?.taskPriorityDisplayStyle, style)
    })
  }
})

test("Settings route persists workspace priority display style", async () => {
  await runWithSettingsMocks(async () => {
    mockSettingsAccess("text")
    let persistedStyle: unknown

    ;(db.userSettings as typeof db.userSettings).upsert = ((async () => ({
      workspaceId: "workspace-1",
      userId: "actor-1",
    })) as unknown) as typeof db.userSettings.upsert
    ;(db.workspace as typeof db.workspace).update = ((async (args: unknown) => {
      persistedStyle = (args as { data: { taskPriorityDisplayStyle?: unknown } }).data.taskPriorityDisplayStyle
      return { taskPriorityDisplayStyle: persistedStyle }
    }) as unknown) as typeof db.workspace.update

    const request = new NextRequest("http://localhost/api/settings", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": "actor-1",
      },
      body: JSON.stringify({
        workspaceId: "workspace-1",
        userId: "actor-1",
        taskPriorityDisplayStyle: "arrow",
      }),
    })

    const response = await putSettings(request)
    const payload = (await response.json()) as {
      workspace?: { taskPriorityDisplayStyle?: string }
    }

    assert.equal(response.status, 200)
    assert.equal(persistedStyle, "arrow")
    assert.equal(payload.workspace?.taskPriorityDisplayStyle, "arrow")
  })
})

async function putPriorityStyleAs(role: "OWNER" | "ADMIN" | "MEMBER" | "VIEWER") {
  let workspaceUpdated = false
  ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
    id: "workspace-1",
    ownerId: "owner-1",
    taskPriorityDisplayStyle: "badge",
  })) as unknown) as typeof db.workspace.findUnique
  ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
    userId: "actor-1",
    role,
  })) as unknown) as typeof db.workspaceMember.findUnique
  ;(db.userSettings as typeof db.userSettings).upsert = ((async () => ({
    workspaceId: "workspace-1",
    userId: "actor-1",
  })) as unknown) as typeof db.userSettings.upsert
  ;(db.workspace as typeof db.workspace).update = ((async () => {
    workspaceUpdated = true
    return { taskPriorityDisplayStyle: "arrow" }
  }) as unknown) as typeof db.workspace.update

  const response = await putSettings(
    new NextRequest("http://localhost/api/settings", {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-flowboard-user-id": "actor-1",
      },
      body: JSON.stringify({
        workspaceId: "workspace-1",
        userId: "actor-1",
        taskPriorityDisplayStyle: "arrow",
      }),
    })
  )

  return { response, workspaceUpdated }
}

test("workspace priority style requires ADMIN or OWNER", async () => {
  for (const role of ["MEMBER", "VIEWER"] as const) {
    await runWithSettingsMocks(async () => {
      const result = await putPriorityStyleAs(role)
      assert.equal(result.response.status, 403)
      assert.equal(result.workspaceUpdated, false)
    })
  }

  for (const role of ["ADMIN", "OWNER"] as const) {
    await runWithSettingsMocks(async () => {
      const result = await putPriorityStyleAs(role)
      assert.equal(result.response.status, 200)
      assert.equal(result.workspaceUpdated, true)
    })
  }
})

test("MEMBER can still update a personal appearance setting", async () => {
  await runWithSettingsMocks(async () => {
    ;(db.workspace as typeof db.workspace).findUnique = ((async () => ({
      id: "workspace-1",
      ownerId: "owner-1",
      taskPriorityDisplayStyle: "badge",
    })) as unknown) as typeof db.workspace.findUnique
    ;(db.workspaceMember as typeof db.workspaceMember).findUnique = ((async () => ({
      userId: "actor-1",
      role: "MEMBER",
    })) as unknown) as typeof db.workspaceMember.findUnique

    let savedTheme: unknown
    ;(db.userSettings as typeof db.userSettings).upsert = ((async (args: unknown) => {
      savedTheme = (args as { update: { theme?: unknown } }).update.theme
      return { workspaceId: "workspace-1", userId: "actor-1", theme: savedTheme }
    }) as unknown) as typeof db.userSettings.upsert

    const response = await putSettings(
      new NextRequest("http://localhost/api/settings", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-flowboard-user-id": "actor-1",
        },
        body: JSON.stringify({
          workspaceId: "workspace-1",
          userId: "actor-1",
          theme: "dark",
        }),
      })
    )

    assert.equal(response.status, 200)
    assert.equal(savedTheme, "dark")
  })
})

test("Settings hides the workspace priority control from lower roles", async () => {
  const settingsPage = await readProjectFile("src/app/app/settings/page.tsx")
  assert.match(settingsPage, /canManageWorkspaceSettings\s*&&\s*\(/)
  assert.match(settingsPage, /session\.members\?\.find\(\(member\) => member\.id === session\.user\.id\)/)
})

import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const source = (file: string) => readFile(new URL(`../${file}`, import.meta.url), 'utf8')

describe('shared motion implementations', () => {
  it('opens shared dropdowns below their trigger with asymmetric motion', async () => {
    const [dropdown, styles] = await Promise.all([
      source('src/components/ui/dropdown-menu.tsx'),
      source('src/index.css'),
    ])

    expect(dropdown).toContain('menu-surface')
    expect(dropdown).toContain('side = "bottom"')
    expect(dropdown).not.toContain('LiquidMenuChrome')
    expect(styles).toContain('menu-surface-open 190ms')
    expect(styles).toContain('menu-surface-close 150ms')
  })

  it('highlights Quick capture with a bounded reduced-motion-safe entrance', async () => {
    const [shell, styles] = await Promise.all([
      source('src/components/AppShell.tsx'),
      source('src/index.css'),
    ])

    expect(shell).toContain('quick-capture-primary')
    expect(shell).toContain('bg-primary')
    expect(styles).toContain('animation: quick-capture-attention 720ms')
    expect(styles).toContain('400ms 2')
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)')
  })

  it('keeps the dragged board card in an overlay with one measured insertion hole', async () => {
    const board = await source('src/pages/Board.tsx')

    expect(board).toContain('DragOverlay')
    expect(board).toContain('pickupSnapshot')
    expect(board).toContain('data-slotwrap')
    expect(board).toContain('useVelocity')
    expect(board).not.toContain('LAND_EASE')
    expect(board).toContain('<BoardCard key={task.id} task={task} collapsed />')
    expect(board).toContain('targetRef.current')
    expect(board).toContain('dropAnimation={null}')
    expect(board).toContain('getBoardDropPatch')
    expect(board).toContain('style={{ width: overlayWidth, rotate: tilt }}')
    expect(board).not.toContain('layout="position"')
    expect(board).not.toContain('animate={{ height:')
    expect(board).toContain('setDropPreview(placeBoardTask')
    expect(board).not.toContain("t.status === 'in_review' ? 'in_progress'")
    expect(board).not.toContain("{tasks.filter((task) => activeId !== task.id).flatMap")
  })

  it('uses one menu surface treatment for selects and popovers', async () => {
    const [select, popover] = await Promise.all([
      source('src/components/ui/select.tsx'),
      source('src/components/ui/popover.tsx'),
    ])

    expect(select).toContain('menu-surface')
    expect(popover).toContain('menu-surface')
    expect(select).not.toContain('zoom-in-95')
    expect(popover).not.toContain('zoom-in-95')
  })

  it('keeps app chrome fixed, task details modal, and Home priority markers quiet', async () => {
    const [shell, drawer, home, styles] = await Promise.all([
      source('src/components/AppShell.tsx'),
      source('src/components/TaskDrawer.tsx'),
      source('src/pages/Home.tsx'),
      source('src/index.css'),
    ])

    expect(shell).toContain("'fixed inset-y-0 left-0")
    expect(shell).toContain("'md:pl-[228px]'")
    expect(drawer).not.toContain('modal={false}')
    expect(drawer).toContain('preventBackgroundScroll')
    expect(drawer).toContain('overscroll-contain')
    expect(home).toContain('mutedPriority')
    expect(styles).toMatch(/html \{\r?\n\s+-webkit-text-size-adjust: 100%;\r?\n\s+overflow-x: hidden;\r?\n\s+scrollbar-gutter: stable/)
    expect(styles).toContain('html body[data-scroll-locked]')
    expect(styles).toContain('margin-right: 0 !important')
  })
})

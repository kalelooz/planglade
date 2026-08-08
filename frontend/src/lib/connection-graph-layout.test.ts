import { describe, expect, it } from 'vitest'
import { minWidthForPackedRow, packGraphRow } from '@/lib/connection-graph-layout'

describe('connection graph layout', () => {
  it('spaces crowded nodes in one row without overlap', () => {
    const nodes = [
      { id: 'note:1', x: 100, width: 196 },
      { id: 'note:2', x: 120, width: 196 },
      { id: 'note:3', x: 130, width: 196 },
    ]
    const packed = packGraphRow(nodes, minWidthForPackedRow(nodes.length, 196))

    expect(packed[1]!.x).toBeGreaterThanOrEqual(packed[0]!.x + packed[0]!.width + 24)
    expect(packed[2]!.x).toBeGreaterThanOrEqual(packed[1]!.x + packed[1]!.width + 24)
  })

  it('keeps a packed row inside the padded canvas when there is enough width', () => {
    const nodes = [
      { id: 'person:1', x: 800, width: 164 },
      { id: 'person:2', x: 820, width: 164 },
    ]
    const contentWidth = minWidthForPackedRow(nodes.length, 164)
    const packed = packGraphRow(nodes, contentWidth)

    expect(packed[0]!.x).toBeGreaterThanOrEqual(48)
    expect(packed[1]!.x + packed[1]!.width).toBeLessThanOrEqual(contentWidth - 48)
  })
})

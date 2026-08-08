import { describe, expect, it } from 'vitest'
import { zoomPanAtPoint } from '@/lib/graph-zoom'

describe('zoomPanAtPoint', () => {
  it('keeps the world point under the cursor fixed while zooming', () => {
    const pan = { x: 40, y: -20 }
    const cursor = { x: 610, y: 180 }
    const zoom = 0.75
    const nextZoom = 1.2
    const worldBefore = {
      x: (cursor.x - pan.x) / zoom,
      y: (cursor.y - pan.y) / zoom,
    }
    const nextPan = zoomPanAtPoint(pan, zoom, nextZoom, cursor)
    const worldAfter = {
      x: (cursor.x - nextPan.x) / nextZoom,
      y: (cursor.y - nextPan.y) / nextZoom,
    }

    expect(worldAfter.x).toBeCloseTo(worldBefore.x)
    expect(worldAfter.y).toBeCloseTo(worldBefore.y)
  })
})

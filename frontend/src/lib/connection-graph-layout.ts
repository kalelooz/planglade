export type PackedGraphNode = {
  id: string
  x: number
  width: number
}

export function minWidthForPackedRow(count: number, nodeWidth: number, gap = 24, padding = 48) {
  if (count <= 0) return 0
  return padding * 2 + count * nodeWidth + (count - 1) * gap
}

export function packGraphRow<T extends PackedGraphNode>(nodes: T[], contentWidth: number, gap = 24, padding = 48): T[] {
  if (nodes.length === 0) return []
  const rightEdge = Math.max(padding, contentWidth - padding)
  const placed = [...nodes]
    .sort((a, b) => a.x - b.x)
    .map((node, index, sorted) => {
      const previous = index > 0 ? sorted[index - 1] : null
      const minX = previous ? previous.x + previous.width + gap : padding
      const x = Math.max(node.x, minX)
      const copy = { ...node, x }
      sorted[index] = copy
      return copy
    })
  const overflow = placed[placed.length - 1]!.x + placed[placed.length - 1]!.width - rightEdge
  if (overflow <= 0) return placed
  const shift = Math.min(overflow, Math.max(0, placed[0]!.x - padding))
  return placed.map((node) => ({ ...node, x: node.x - shift }))
}

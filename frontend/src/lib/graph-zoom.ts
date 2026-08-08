export type Point = { x: number; y: number }

export function zoomPanAtPoint(pan: Point, zoom: number, nextZoom: number, anchor: Point): Point {
  const ratio = nextZoom / zoom
  return {
    x: anchor.x - (anchor.x - pan.x) * ratio,
    y: anchor.y - (anchor.y - pan.y) * ratio,
  }
}

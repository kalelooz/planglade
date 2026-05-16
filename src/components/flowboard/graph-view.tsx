"use client"

import * as React from "react"
import { ZoomIn, ZoomOut, Maximize2, X, User, Calendar, Flag } from "lucide-react"

import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useNavStore } from "@/components/flowboard/nav-store"
import { useDrawer } from "@/components/flowboard/drawer-context"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NodeType = "project" | "task" | "note"
type Priority = "High" | "Medium" | "Low"

interface GraphNode {
  id: string
  label: string
  type: NodeType
  x: number
  y: number
  // Extra data for task popover
  priority?: Priority
  assignee?: string
  assigneeName?: string
  dueDate?: string
  // Extra data for note navigation
  noteId?: string
}

interface GraphEdge {
  from: string
  to: string
}

// ---------------------------------------------------------------------------
// Mock Data
// ---------------------------------------------------------------------------

const nodes: GraphNode[] = [
  // 3 Projects — large teal
  { id: "P1", label: "Website Redesign", type: "project", x: 320, y: 120 },
  { id: "P2", label: "Mobile App v2", type: "project", x: 620, y: 120 },
  { id: "P3", label: "API Migration", type: "project", x: 920, y: 120 },

  // 8 Tasks — medium gray
  { id: "T1", label: "Homepage Mockups", type: "task", x: 160, y: 300, priority: "Medium", assignee: "LP", assigneeName: "Lisa Park", dueDate: "Jun 5" },
  { id: "T2", label: "Responsive Nav", type: "task", x: 360, y: 300, priority: "High", assignee: "SK", assigneeName: "Sara Kim", dueDate: "May 20" },
  { id: "T3", label: "Auth Flow", type: "task", x: 520, y: 300, priority: "High", assignee: "JD", assigneeName: "Jake Davis", dueDate: "May 19" },
  { id: "T4", label: "Push Notifications", type: "task", x: 720, y: 300, priority: "Medium", assignee: "SK", assigneeName: "Sara Kim", dueDate: "May 22" },
  { id: "T5", label: "Onboarding Flow", type: "task", x: 880, y: 300, priority: "Low", assignee: "AM", assigneeName: "Alex Morgan", dueDate: "Jun 10" },
  { id: "T6", label: "Endpoint Migration", type: "task", x: 1020, y: 300, priority: "High", assignee: "JD", assigneeName: "Jake Davis", dueDate: "Aug 1" },
  { id: "T7", label: "Rate Limiting", type: "task", x: 1080, y: 180, priority: "Medium", assignee: "RC", assigneeName: "Raj Chen", dueDate: "Jun 12" },
  { id: "T8", label: "Design Tokens", type: "task", x: 460, y: 180, priority: "Medium", assignee: "LP", assigneeName: "Lisa Park", dueDate: "May 22" },

  // 5 Notes — small yellow
  { id: "N1", label: "Q3 Roadmap", type: "note", x: 260, y: 460, noteId: "N1" },
  { id: "N2", label: "Team Meeting Notes", type: "note", x: 460, y: 460, noteId: "N2" },
  { id: "N3", label: "Design Brief", type: "note", x: 660, y: 460, noteId: "N3" },
  { id: "N4", label: "User Research", type: "note", x: 860, y: 460, noteId: "N4" },
  { id: "N5", label: "API Deprecation Plan", type: "note", x: 1040, y: 460, noteId: "N5" },
]

const edges: GraphEdge[] = [
  // Website Redesign → Tasks
  { from: "P1", to: "T1" },
  { from: "P1", to: "T2" },
  { from: "P1", to: "T8" },
  // Mobile App v2 → Tasks
  { from: "P2", to: "T3" },
  { from: "P2", to: "T4" },
  { from: "P2", to: "T5" },
  // API Migration → Tasks
  { from: "P3", to: "T6" },
  { from: "P3", to: "T7" },
  // Cross-project task links
  { from: "T8", to: "T2" },
  { from: "T3", to: "T7" },
  // Tasks → Notes
  { from: "T1", to: "N1" },
  { from: "T2", to: "N2" },
  { from: "T8", to: "N3" },
  { from: "T4", to: "N4" },
  { from: "T3", to: "N4" },
  { from: "T6", to: "N5" },
  { from: "T7", to: "N5" },
  // Note → Note
  { from: "N1", to: "N2" },
  { from: "N3", to: "N4" },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nodeRadius(type: NodeType) {
  switch (type) {
    case "project": return 28
    case "task": return 18
    case "note": return 13
  }
}

function nodeFill(type: NodeType, isHovered: boolean, isDark: boolean) {
  switch (type) {
    case "project":
      return isHovered ? "#018a92" : "#01696f"
    case "task":
      return isHovered ? "#6b7280" : (isDark ? "#6b7280" : "#9ca3af")
    case "note":
      return isHovered ? "#d97706" : (isDark ? "#b47a14" : "#fbbf24")
  }
}

function nodeStroke(type: NodeType, isDark: boolean) {
  switch (type) {
    case "project": return isDark ? "#01b5bf" : "#014449"
    case "task": return isDark ? "#9ca3af" : "#6b7280"
    case "note": return isDark ? "#d97706" : "#b45309"
  }
}

function nodeOpacity(type: NodeType, isHovered: boolean) {
  if (isHovered) return 1
  switch (type) {
    case "project": return 0.9
    case "task": return 0.75
    case "note": return 0.8
  }
}

function priorityColor(priority: Priority) {
  switch (priority) {
    case "High": return "#ef4444"
    case "Medium": return "#f59e0b"
    case "Low": return "#9ca3af"
  }
}

function priorityBg(priority: Priority, isDark: boolean) {
  switch (priority) {
    case "High": return isDark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.1)"
    case "Medium": return isDark ? "rgba(245,158,11,0.15)" : "rgba(245,158,11,0.1)"
    case "Low": return isDark ? "rgba(156,163,175,0.15)" : "rgba(156,163,175,0.1)"
  }
}

const CANVAS_W = 1240
const CANVAS_H = 560
const MIN_ZOOM = 0.3
const MAX_ZOOM = 3
const STAGGER_MS = 30

// ---------------------------------------------------------------------------
// Task Detail Popover (HTML overlay positioned absolutely)
// ---------------------------------------------------------------------------

function TaskPopover({
  node,
  isDark,
  onClose,
  style,
}: {
  node: GraphNode
  isDark: boolean
  onClose: () => void
  style: React.CSSProperties
}) {
  const priority = node.priority ?? "Medium"
  const prColor = priorityColor(priority)

  return (
    <div
      style={style}
      className="absolute z-20 w-56 rounded-lg border shadow-lg bg-popover border-border"
    >
      {/* Colored top strip */}
      <div className="h-1 rounded-t-lg" style={{ backgroundColor: prColor }} />

      <div className="p-3">
        {/* Close button */}
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          className="absolute top-2 right-2 p-0.5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="size-3.5" />
        </button>

        {/* Title */}
        <p className="text-sm font-semibold pr-5 leading-tight mb-2.5">{node.label}</p>

        {/* Priority */}
        <div className="flex items-center gap-2 mb-1.5">
          <Flag className="size-3.5" style={{ color: prColor }} />
          <span
            className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
            style={{ color: prColor, backgroundColor: priorityBg(priority, isDark) }}
          >
            {priority} Priority
          </span>
        </div>

        {/* Assignee */}
        {node.assigneeName && (
          <div className="flex items-center gap-2 mb-1.5">
            <User className="size-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{node.assigneeName}</span>
          </div>
        )}

        {/* Due date */}
        {node.dueDate && (
          <div className="flex items-center gap-2">
            <Calendar className="size-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{node.dueDate}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Graph View Component
// ---------------------------------------------------------------------------

export function GraphView() {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = React.useState(1)
  const [isDark, setIsDark] = React.useState(false)
  const [pan, setPan] = React.useState({ x: 0, y: 0 })
  const [hoveredNode, setHoveredNode] = React.useState<string | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [svgSize, setSvgSize] = React.useState({ w: CANVAS_W, h: CANVAS_H })
  const [mounted, setMounted] = React.useState(false)
  const [popoverNodeId, setPopoverNodeId] = React.useState<string | null>(null)
  const [popoverPos, setPopoverPos] = React.useState({ x: 0, y: 0 })
  const dragStart = React.useRef({ x: 0, y: 0, panX: 0, panY: 0 })
  const hasInitialized = React.useRef(false)
  const dragMoved = React.useRef(false)

  const setActiveView = useNavStore((s) => s.setActiveView)
  const setSelectedNoteId = useNavStore((s) => s.setSelectedNoteId)
  const { openDrawer } = useDrawer()

  // Trigger entrance animation after mount
  React.useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

  // Track dark mode reactively
  React.useEffect(() => {
    const check = () => setIsDark(document.documentElement.classList.contains("dark"))
    check()
    const observer = new MutationObserver(check)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
    return () => observer.disconnect()
  }, [])

  // Measure container and compute initial zoom/pan to fit all nodes
  React.useEffect(() => {
    const container = containerRef.current
    if (!container || hasInitialized.current) return

    const measureAndFit = () => {
      const rect = container.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return

      const padding = 60
      const scaleX = (rect.width - padding * 2) / CANVAS_W
      const scaleY = (rect.height - padding * 2) / CANVAS_H
      const fitZoom = Math.min(scaleX, scaleY, 1.2)

      const scaledW = CANVAS_W * fitZoom
      const scaledH = CANVAS_H * fitZoom
      const offsetX = (rect.width - scaledW) / 2
      const offsetY = (rect.height - scaledH) / 2

      setZoom(fitZoom)
      setPan({ x: offsetX, y: offsetY })
      setSvgSize({ w: rect.width, h: rect.height })
      hasInitialized.current = true
    }

    measureAndFit()
    const timer = setTimeout(measureAndFit, 100)
    return () => clearTimeout(timer)
  }, [])

  // Update SVG size on resize
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setSvgSize({ w: width, h: height })
        }
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Convert SVG coords to screen coords (for popover positioning)
  const svgToScreen = React.useCallback((svgX: number, svgY: number) => {
    return {
      x: svgX * zoom + pan.x,
      y: svgY * zoom + pan.y,
    }
  }, [pan, zoom])

  // Mouse wheel zoom — zoom toward cursor position
  const handleWheel = React.useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.08 : 0.08
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + delta * zoom))

    const container = containerRef.current
    if (container) {
      const rect = container.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const ratio = newZoom / zoom
      setPan({
        x: mx - ratio * (mx - pan.x),
        y: my - ratio * (my - pan.y),
      })
    }
    setZoom(newZoom)
  }, [zoom, pan])

  // Drag to pan
  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    setIsDragging(true)
    dragMoved.current = false
    dragStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y }
  }, [pan])

  const handleMouseMove = React.useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    // Mark as drag if moved more than 3px
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragMoved.current = true
    }
    setPan({ x: dragStart.current.panX + dx, y: dragStart.current.panY + dy })
  }, [isDragging])

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false)
  }, [])

  // Click handler for node navigation
  const handleNodeClick = React.useCallback((node: GraphNode) => {
    // Ignore clicks that were actually drags
    if (dragMoved.current) return

    switch (node.type) {
      case "project":
        openDrawer("project", node.id)
        break
      case "note":
        openDrawer("note", node.noteId ?? node.id)
        break
      case "task":
        // Show popover AND open drawer
        const screenPos = svgToScreen(node.x, node.y)
        const r = nodeRadius(node.type)
        setPopoverPos({
          x: screenPos.x,
          y: screenPos.y - (r * zoom) - 8, // above the node
        })
        setPopoverNodeId(node.id)
        openDrawer("task", node.id)
        break
    }
  }, [openDrawer, svgToScreen, zoom])

  // Close popover on click outside
  const handleCanvasClick = React.useCallback(() => {
    if (popoverNodeId) {
      setPopoverNodeId(null)
    }
  }, [popoverNodeId])

  // Zoom controls
  const handleZoomIn = () => {
    const newZoom = Math.min(MAX_ZOOM, zoom + 0.15)
    const cx = svgSize.w / 2
    const cy = svgSize.h / 2
    const ratio = newZoom / zoom
    setPan({ x: cx - ratio * (cx - pan.x), y: cy - ratio * (cy - pan.y) })
    setZoom(newZoom)
  }
  const handleZoomOut = () => {
    const newZoom = Math.max(MIN_ZOOM, zoom - 0.15)
    const cx = svgSize.w / 2
    const cy = svgSize.h / 2
    const ratio = newZoom / zoom
    setPan({ x: cx - ratio * (cx - pan.x), y: cy - ratio * (cy - pan.y) })
    setZoom(newZoom)
  }
  const handleReset = () => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    const padding = 60
    const scaleX = (rect.width - padding * 2) / CANVAS_W
    const scaleY = (rect.height - padding * 2) / CANVAS_H
    const fitZoom = Math.min(scaleX, scaleY, 1.2)
    const scaledW = CANVAS_W * fitZoom
    const scaledH = CANVAS_H * fitZoom
    setZoom(fitZoom)
    setPan({ x: (rect.width - scaledW) / 2, y: (rect.height - scaledH) / 2 })
  }

  // Count node types
  const projectCount = nodes.filter((n) => n.type === "project").length
  const taskCount = nodes.filter((n) => n.type === "task").length
  const noteCount = nodes.filter((n) => n.type === "note").length

  // Related nodes for hover highlight
  const relatedIds = React.useMemo(() => {
    if (!hoveredNode) return new Set<string>()
    const related = new Set<string>()
    related.add(hoveredNode)
    for (const e of edges) {
      if (e.from === hoveredNode) related.add(e.to)
      if (e.to === hoveredNode) related.add(e.from)
    }
    return related
  }, [hoveredNode])

  // Popover node data
  const popoverNode = popoverNodeId ? nodes.find((n) => n.id === popoverNodeId) : null

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Graph View</h2>
          <p className="text-sm text-muted-foreground">
            Visualize connections between projects, tasks, and notes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="gap-1.5 bg-primary/10 text-primary hover:bg-primary/15 border-primary/20">
            <span className="size-2 rounded-full bg-primary" />
            {projectCount} Projects
          </Badge>
          <Badge className="gap-1.5 bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-200">
            <span className="size-2 rounded-full bg-gray-400" />
            {taskCount} Tasks
          </Badge>
          <Badge className="gap-1.5 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:bg-amber-100">
            <span className="size-2 rounded-full bg-amber-400" />
            {noteCount} Notes
          </Badge>
        </div>
      </div>

      {/* Graph canvas */}
      <Card className="flex-1 relative overflow-hidden min-h-[420px]" onClick={handleCanvasClick}>
        {/* Zoom controls overlay */}
        <div className="absolute top-3 right-3 z-10 flex flex-col gap-1">
          <Button variant="secondary" size="icon" className="size-8" onClick={handleZoomIn}>
            <ZoomIn className="size-4" />
          </Button>
          <Button variant="secondary" size="icon" className="size-8" onClick={handleZoomOut}>
            <ZoomOut className="size-4" />
          </Button>
          <Button variant="secondary" size="icon" className="size-8" onClick={handleReset}>
            <Maximize2 className="size-4" />
          </Button>
          <div className="text-center text-[10px] text-muted-foreground mt-1 font-medium">
            {Math.round(zoom * 100)}%
          </div>
        </div>

        {/* Instructions overlay */}
        <div className="absolute bottom-3 left-3 z-10 text-[10px] text-muted-foreground flex gap-3">
          <span>Scroll to zoom</span>
          <span>Drag to pan</span>
          <span>Hover for details</span>
          <span className="hidden sm:inline">Click to navigate</span>
        </div>

        {/* Task detail popover */}
        {popoverNode && (
          <TaskPopover
            node={popoverNode}
            isDark={isDark}
            onClose={() => setPopoverNodeId(null)}
            style={{
              left: popoverPos.x - 112, // center 224px popover
              top: popoverPos.y - 8,
            }}
          />
        )}

        {/* SVG Canvas — uses a <g> transform group for zoom/pan */}
        <div
          ref={containerRef}
          className="w-full h-full cursor-grab active:cursor-grabbing"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg
            width="100%"
            height="100%"
            viewBox={`0 0 ${svgSize.w} ${svgSize.h}`}
            className="select-none"
          >
            <defs>
              {/* Arrow marker */}
              <marker
                id="arrowhead"
                viewBox="0 0 10 7"
                refX="10"
                refY="3.5"
                markerWidth="8"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <polygon points="0 0, 10 3.5, 0 7" className="fill-muted-foreground/40" />
              </marker>
            </defs>

            {/* Transform group for zoom/pan */}
            <g
              transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
              style={{
                transition: isDragging ? "none" : "transform 0.15s ease-out",
              }}
            >
              {/* Background grid pattern */}
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="20" cy="20" r="0.6" className="fill-muted-foreground/20" />
              </pattern>
              <rect width={CANVAS_W} height={CANVAS_H} fill="url(#grid)" />

              {/* Edges */}
              {edges.map((edge, edgeIdx) => {
                const fromNode = nodes.find((n) => n.id === edge.from)
                const toNode = nodes.find((n) => n.id === edge.to)
                if (!fromNode || !toNode) return null

                const isHighlighted = hoveredNode !== null && (relatedIds.has(edge.from) && relatedIds.has(edge.to))
                const isDimmed = hoveredNode !== null && !isHighlighted

                // Shorten line so it doesn't overlap the circles
                const fromR = nodeRadius(fromNode.type)
                const toR = nodeRadius(toNode.type)
                const dx = toNode.x - fromNode.x
                const dy = toNode.y - fromNode.y
                const dist = Math.sqrt(dx * dx + dy * dy)
                const ux = dx / dist
                const uy = dy / dist

                const x1 = fromNode.x + ux * (fromR + 3)
                const y1 = fromNode.y + uy * (fromR + 3)
                const x2 = toNode.x - ux * (toR + 8)
                const y2 = toNode.y - uy * (toR + 8)

                return (
                  <line
                    key={`${edge.from}-${edge.to}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    className="stroke-muted-foreground/30"
                    strokeWidth={isHighlighted ? 2 : 1.2}
                    markerEnd="url(#arrowhead)"
                    style={{
                      opacity: isDimmed ? 0.15 : isHighlighted ? 0.8 : 0.4,
                      transition: "opacity 0.2s, stroke-width 0.2s",
                      // Staggered entrance
                      transform: mounted ? "scale(1)" : "scale(0)",
                      transformOrigin: `${(x1 + x2) / 2}px ${(y1 + y2) / 2}px`,
                    }}
                  />
                )
              })}

              {/* Nodes */}
              {nodes.map((node, nodeIdx) => {
                const isHovered = hoveredNode === node.id
                const isRelated = relatedIds.has(node.id)
                const isDimmed = hoveredNode !== null && !isRelated
                const r = nodeRadius(node.type)
                const delay = nodeIdx * STAGGER_MS

                return (
                  <g
                    key={node.id}
                    style={{
                      opacity: isDimmed ? 0.25 : (mounted ? 1 : 0),
                      cursor: "pointer",
                      // Staggered entrance: scale from 0 + fade in
                      transform: mounted ? "scale(1)" : "scale(0)",
                      transformOrigin: `${node.x}px ${node.y}px`,
                      transition: `opacity 0.35s ease-out ${delay}ms, transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${delay}ms`,
                    }}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={(e) => { e.stopPropagation(); handleNodeClick(node) }}
                  >
                    {/* Glow on hover */}
                    {isHovered && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={r + 8}
                        className="fill-primary/10"
                        style={{ transition: "r 0.2s" }}
                      />
                    )}
                    {/* Main circle */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={r}
                      fill={nodeFill(node.type, isHovered, isDark)}
                      stroke={nodeStroke(node.type, isDark)}
                      strokeWidth={isHovered ? 2.5 : 1.5}
                      opacity={nodeOpacity(node.type, isHovered)}
                      style={{ transition: "r 0.2s, stroke-width 0.2s, opacity 0.2s" }}
                    />
                    {/* Label on hover */}
                    {isHovered && (
                      <g>
                        {/* Label background */}
                        <rect
                          x={node.x - 70}
                          y={node.y - r - 28}
                          width={140}
                          height={22}
                          rx={6}
                          className="fill-popover stroke-border"
                          strokeWidth={1}
                        />
                        {/* Label text */}
                        <text
                          x={node.x}
                          y={node.y - r - 14}
                          textAnchor="middle"
                          className="fill-foreground text-[11px] font-medium"
                          style={{ userSelect: "none" }}
                        >
                          {node.label}
                        </text>
                        {/* Type badge */}
                        <text
                          x={node.x}
                          y={node.y + r + 16}
                          textAnchor="middle"
                          className="fill-muted-foreground text-[9px] font-medium uppercase tracking-wider"
                          style={{ userSelect: "none" }}
                        >
                          {node.type}
                        </text>
                      </g>
                    )}
                    {/* Node initial (always visible for projects) */}
                    {node.type === "project" && !isHovered && (
                      <text
                        x={node.x}
                        y={node.y + 1}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-white text-[11px] font-bold"
                        style={{ userSelect: "none" }}
                      >
                        {node.label.charAt(0)}
                      </text>
                    )}
                    {/* Click hint icon for projects and notes */}
                    {isHovered && (node.type === "project" || node.type === "note") && (
                      <text
                        x={node.x}
                        y={node.y + r + 28}
                        textAnchor="middle"
                        className="fill-muted-foreground text-[8px]"
                        style={{ userSelect: "none" }}
                      >
                        Click to view details
                      </text>
                    )}
                    {/* Click hint for tasks */}
                    {isHovered && node.type === "task" && (
                      <text
                        x={node.x}
                        y={node.y + r + 28}
                        textAnchor="middle"
                        className="fill-muted-foreground text-[8px]"
                        style={{ userSelect: "none" }}
                      >
                        Click to view details
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          </svg>
        </div>
      </Card>
    </div>
  )
}

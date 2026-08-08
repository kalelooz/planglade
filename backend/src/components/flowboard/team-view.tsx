"use client"

import * as React from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import {
  tasks,
  members,
  type DrawerTask,
  type DrawerMember,
  type TaskStatus,
  priorityBadgeStyle,
} from "@/components/flowboard/drawer-data"
import { useDrawer } from "@/components/flowboard/drawer-context"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { Users } from "lucide-react"

type Availability = "Available" | "Busy" | "Overloaded"

function getAvailability(activeCount: number): Availability {
  if (activeCount <= 3) return "Available"
  if (activeCount <= 5) return "Busy"
  return "Overloaded"
}

const availabilityConfig: Record<Availability, { dot: string; label: string; bg: string }> = {
  Available: { dot: "bg-emerald-500", label: "Available", bg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" },
  Busy: { dot: "bg-amber-500", label: "Busy", bg: "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400" },
  Overloaded: { dot: "bg-red-500", label: "Overloaded", bg: "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400" },
}

const statusDotColor = (status: TaskStatus): string => {
  switch (status) {
    case "Backlog": return "bg-gray-400"
    case "In Progress": return "bg-primary"
    case "In Review": return "bg-amber-500"
    case "Done": return "bg-emerald-500"
  }
}

interface EnrichedMember {
  member: DrawerMember
  memberTasks: DrawerTask[]
  activeTasks: DrawerTask[]
  highCount: number
  mediumCount: number
  lowCount: number
  activeCount: number
  availability: Availability
  recentTasks: DrawerTask[]
}

function WorkloadBar({ em }: { em: EnrichedMember }) {
  const total = em.activeCount
  if (total === 0) {
    return <div className="h-2.5 w-full rounded-full bg-muted/40" />
  }
  const highPct = (em.highCount / total) * 100
  const medPct = (em.mediumCount / total) * 100
  const lowPct = (em.lowCount / total) * 100

  return (
    <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted/30">
      {em.highCount > 0 && (
        <div className="bg-red-500 transition-all" style={{ width: `${highPct}%` }} />
      )}
      {em.mediumCount > 0 && (
        <div className="bg-amber-400 transition-all" style={{ width: `${medPct}%` }} />
      )}
      {em.lowCount > 0 && (
        <div className="bg-gray-400 dark:bg-gray-500 transition-all" style={{ width: `${lowPct}%` }} />
      )}
    </div>
  )
}

function CustomChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md text-xs">
      <p className="font-semibold text-sm mb-1">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-muted-foreground">{entry.dataKey}:</span>
          <span className="font-semibold">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export function TeamView() {
  const { openDrawer } = useDrawer()

  const enrichedMembers: EnrichedMember[] = React.useMemo(
    () =>
      members.map((member) => {
        const memberTasks = tasks.filter((t) => t.assignee === member.initials)
        const activeTasks = memberTasks.filter((t) => t.status !== "Done")
        const highCount = activeTasks.filter((t) => t.priority === "High").length
        const mediumCount = activeTasks.filter((t) => t.priority === "Medium").length
        const lowCount = activeTasks.filter((t) => t.priority === "Low").length
        const activeCount = activeTasks.length
        const availability = getAvailability(activeCount)
        const statusOrder: Record<TaskStatus, number> = { "In Progress": 0, "In Review": 1, Backlog: 2, Done: 3 }
        const recentTasks = [...activeTasks]
          .sort((a, b) => statusOrder[a.status] - statusOrder[b.status])
          .slice(0, 3)

        return { member, memberTasks, activeTasks, highCount, mediumCount, lowCount, activeCount, availability, recentTasks }
      }),
    []
  )

  const chartData = React.useMemo(
    () =>
      enrichedMembers.map((em) => ({
        name: em.member.name.split(" ")[0],
        High: em.highCount,
        Medium: em.mediumCount,
        Low: em.lowCount,
      })),
    [enrichedMembers]
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="size-5 text-primary" />
          <h2 className="text-xl font-semibold tracking-tight">Team Members</h2>
          <span className="text-sm text-muted-foreground">
            {members.length} members across {tasks.length} tasks
          </span>
        </div>
      </div>

      <Card className="py-0">
        <CardContent className="p-5">
          <div className="mb-4">
            <h3 className="text-base font-semibold">Workload Summary</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Active tasks per member grouped by priority</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                width={28}
                allowDecimals={false}
              />
              <RechartsTooltip content={<CustomChartTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
              />
              <Bar dataKey="High" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} name="High" />
              <Bar dataKey="Medium" stackId="a" fill="#f59e0b" radius={[0, 0, 0, 0]} name="Medium" />
              <Bar dataKey="Low" stackId="a" fill="#9ca3af" radius={[4, 4, 0, 0]} name="Low" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {enrichedMembers.map((em) => {
          const avail = availabilityConfig[em.availability]

          return (
            <Card
              key={em.member.initials}
              className="py-0 cursor-pointer transition-all hover:shadow-md hover:border-primary/30 group"
              onClick={() => openDrawer("member", em.member.initials)}
            >
              <CardContent className="p-5">
                <div className="flex items-start gap-3.5">
                  <Avatar className="size-12 shrink-0 ring-2 ring-offset-2 ring-offset-background group-hover:ring-primary/30 transition-all">
                    <AvatarFallback
                      className="text-sm font-bold text-white"
                      style={{ backgroundColor: em.member.color }}
                    >
                      {em.member.initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-sm truncate">{em.member.name}</h4>
                      <span className="flex items-center gap-1">
                        <span className={cn("size-2 rounded-full shrink-0", avail.dot)} />
                        <span className={cn("text-[10px] font-medium", avail.bg, "px-1.5 py-0.5 rounded-full")}>
                          {avail.label}
                        </span>
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{em.member.role}</p>
                  </div>
                </div>

                <div className="mt-3.5 flex items-center gap-2">
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] font-semibold px-2 py-0.5",
                      em.activeCount === 0
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary"
                    )}
                  >
                    {em.activeCount} task{em.activeCount !== 1 ? "s" : ""} active
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {em.memberTasks.length} total
                  </span>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
                    <span>Workload</span>
                    <span className="flex items-center gap-2">
                      {em.highCount > 0 && (
                        <span className="flex items-center gap-0.5">
                          <span className="size-1.5 rounded-full bg-red-500" />
                          {em.highCount}
                        </span>
                      )}
                      {em.mediumCount > 0 && (
                        <span className="flex items-center gap-0.5">
                          <span className="size-1.5 rounded-full bg-amber-400" />
                          {em.mediumCount}
                        </span>
                      )}
                      {em.lowCount > 0 && (
                        <span className="flex items-center gap-0.5">
                          <span className="size-1.5 rounded-full bg-gray-400" />
                          {em.lowCount}
                        </span>
                      )}
                    </span>
                  </div>
                  <WorkloadBar em={em} />
                </div>

                <div className="mt-3.5 space-y-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Current tasks</p>
                  {em.recentTasks.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">No active tasks</p>
                  ) : (
                    em.recentTasks.map((task) => (
                      <div
                        key={task.id}
                        className="flex items-center gap-2 text-xs py-1 px-2 rounded-md bg-muted/40 hover:bg-muted/60 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          openDrawer("task", task.id)
                        }}
                      >
                        <span className={cn("size-1.5 rounded-full shrink-0", statusDotColor(task.status))} />
                        <span className="truncate flex-1">{task.title}</span>
                        <span
                          className={cn(
                            "text-[9px] font-semibold px-1 py-0 rounded",
                            priorityBadgeStyle(task.priority)
                          )}
                        >
                          {task.priority.charAt(0)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

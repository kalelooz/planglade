import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AtSign, Bell, CircleDot, MessageCircle, RefreshCw, UserRound } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { getNotifications, markNotificationsRead, type Notification } from '@/lib/api/notifications'
import {
  beginNotificationMarkRead,
  completeNotificationMarkRead,
  createNotificationMarkReadRequest,
  failNotificationMarkRead,
  initialNotificationMarkReadState,
  retryNotificationMarkRead,
  type NotificationMarkReadRequest,
  type NotificationMarkReadState,
} from '@/lib/notification-mark-read'

export type NotificationCenterProps = {
  workspaceId: string | null
  onOpenTask: (taskId: string) => void
}

const notificationsKey = (workspaceId: string) => ['notifications', workspaceId] as const

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function NotificationGlyph({ type }: { type: Notification['type'] }) {
  const Icon = type === 'MENTION'
    ? AtSign
    : type === 'ASSIGNED'
      ? UserRound
      : type === 'COMMENT'
        ? MessageCircle
        : CircleDot
  return <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
}

export function NotificationCenter({ workspaceId, onOpenTask }: NotificationCenterProps) {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [markReadState, setMarkReadState] = useState(initialNotificationMarkReadState)
  const markReadStateRef = useRef(markReadState)
  const query = useQuery({
    queryKey: notificationsKey(workspaceId ?? 'none'),
    queryFn: ({ signal }) => getNotifications(workspaceId!, 20, signal),
    enabled: Boolean(workspaceId),
    refetchInterval: workspaceId ? 60_000 : false,
    retry: false,
  })

  const updateMarkReadState = (update: (current: NotificationMarkReadState) => NotificationMarkReadState) => {
    const current = markReadStateRef.current
    const next = update(current)
    if (next === current) return false
    markReadStateRef.current = next
    setMarkReadState(next)
    return true
  }

  const markReadMutation = useMutation({
    mutationFn: ({ workspaceId: submittedWorkspaceId, notificationIds, lastReadAt }: NotificationMarkReadRequest) =>
      markNotificationsRead(submittedWorkspaceId, notificationIds, lastReadAt),
    retry: false,
    onSuccess: (_result, request) => {
      updateMarkReadState((current) => completeNotificationMarkRead(current, request))
      return queryClient.invalidateQueries({ queryKey: notificationsKey(request.workspaceId) })
    },
    onError: (_error, request) => {
      updateMarkReadState((current) => failNotificationMarkRead(current, request))
      toast.error('Notification status could not be updated. Try again from Notifications.')
    },
  })

  const resetMarkReadMutation = markReadMutation.reset
  useEffect(() => {
    resetMarkReadMutation()
    markReadStateRef.current = initialNotificationMarkReadState
    setMarkReadState(initialNotificationMarkReadState)
  }, [workspaceId, resetMarkReadMutation])

  const notifications = query.data?.notifications ?? []
  const unreadCount = query.data?.unreadCount ?? 0
  const unreadLabel = unreadCount > 0 ? `${unreadCount} unread` : 'No unread notifications'

  const markRead = (notificationIds?: string[]) => {
    if (!workspaceId) return
    const request = createNotificationMarkReadRequest(workspaceId, notifications, notificationIds)
    if (!request) return
    const started = updateMarkReadState((current) => beginNotificationMarkRead(current, request))
    if (started) markReadMutation.mutate(request)
  }

  const openNotification = (notification: Notification) => {
    if (notification.isUnread) markRead([notification.id])
    if (notification.workItemId) {
      onOpenTask(notification.workItemId)
      setOpen(false)
    }
  }

  const retryMarkRead = () => {
    const request = markReadStateRef.current.failedRequest
    if (!request || request.workspaceId !== workspaceId) return
    const started = updateMarkReadState(retryNotificationMarkRead)
    if (started) markReadMutation.mutate(request)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={`Notifications, ${unreadLabel}`} className="relative size-11 lg:size-9">
          <Bell className="size-4" aria-hidden="true" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-1 -top-1 min-w-5 justify-center px-1 py-0 text-xs leading-4" aria-hidden="true">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-1.5rem))] p-0">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2.5">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Notifications</h2>
            <p className="text-[12px] text-muted-foreground">{unreadLabel}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => markRead()}
            disabled={!workspaceId || unreadCount === 0 || Boolean(markReadState.pendingRequest || markReadState.failedRequest)}
            className="h-11 shrink-0 px-2.5 text-[12px] lg:h-8"
          >
            Mark all read
          </Button>
        </div>

        {markReadState.failedRequest?.workspaceId === workspaceId && (
          <div role="alert" className="flex items-center justify-between gap-3 border-b border-destructive/20 bg-destructive/5 px-3 py-2.5">
            <p className="text-xs leading-5 text-destructive">Unread status was not updated.</p>
            <Button type="button" variant="ghost" size="sm" onClick={retryMarkRead} disabled={Boolean(markReadState.pendingRequest)} className="h-9 shrink-0 px-2.5 text-xs">
              <RefreshCw className="size-3.5" aria-hidden="true" /> Retry
            </Button>
          </div>
        )}

        {query.isLoading ? (
          <div role="status" aria-label="Loading notifications" className="space-y-3 p-3">
            {[0, 1, 2].map((item) => <Skeleton key={item} className="h-12 w-full" />)}
          </div>
        ) : query.isError ? (
          <div role="alert" className="flex flex-col items-start gap-2 p-3 text-sm">
            <p className="text-destructive">Notifications could not be loaded.</p>
            <Button type="button" variant="ghost" onClick={() => void query.refetch()} className="h-11 px-2.5 lg:h-8">
              <RefreshCw className="size-3.5" aria-hidden="true" /> Try again
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-5 text-center text-sm text-muted-foreground">You’re all caught up.</div>
        ) : (
          <div aria-label="Recent notifications" className="max-h-[min(26rem,calc(100vh-10rem))] overflow-y-auto p-1">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                type="button"
                onClick={() => openNotification(notification)}
                className="flex min-h-11 w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent/60 focus-visible:bg-accent/60"
              >
                <NotificationGlyph type={notification.type} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-start gap-2">
                    <span className={notification.isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/85'}>{notification.title}</span>
                    {notification.isUnread && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  </span>
                  <span className="mt-0.5 block line-clamp-2 text-[12.5px] leading-5 text-muted-foreground">{notification.body}</span>
                  <time dateTime={notification.createdAt} className="mt-1 block text-xs text-muted-foreground">{formatDate(notification.createdAt)}</time>
                </span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

export type NotificationMarkReadRequest = {
  workspaceId: string
  notificationIds?: string[]
  lastReadAt?: string
}

type NotificationTimestamp = {
  createdAt: string
}

export type NotificationMarkReadState = {
  pendingRequest: NotificationMarkReadRequest | null
  failedRequest: NotificationMarkReadRequest | null
}

export const initialNotificationMarkReadState: NotificationMarkReadState = {
  pendingRequest: null,
  failedRequest: null,
}

function newestNotificationCreatedAt(notifications: NotificationTimestamp[]) {
  let newest: string | null = null
  let newestTime = Number.NEGATIVE_INFINITY

  for (const notification of notifications) {
    const time = Date.parse(notification.createdAt)
    if (Number.isFinite(time) && time > newestTime) {
      newest = notification.createdAt
      newestTime = time
    }
  }

  return newest
}

export function createNotificationMarkReadRequest(
  workspaceId: string,
  notifications: NotificationTimestamp[],
  notificationIds?: string[],
): NotificationMarkReadRequest | null {
  if (notificationIds !== undefined) return { workspaceId, notificationIds }

  const lastReadAt = newestNotificationCreatedAt(notifications)
  return lastReadAt ? { workspaceId, lastReadAt } : null
}

export function beginNotificationMarkRead(
  state: NotificationMarkReadState,
  request: NotificationMarkReadRequest,
): NotificationMarkReadState {
  if (state.pendingRequest || state.failedRequest) return state
  return { pendingRequest: request, failedRequest: null }
}

export function retryNotificationMarkRead(state: NotificationMarkReadState): NotificationMarkReadState {
  if (state.pendingRequest || !state.failedRequest) return state
  return { pendingRequest: state.failedRequest, failedRequest: state.failedRequest }
}

export function failNotificationMarkRead(
  state: NotificationMarkReadState,
  request: NotificationMarkReadRequest,
): NotificationMarkReadState {
  if (state.pendingRequest !== request) return state
  return { pendingRequest: null, failedRequest: request }
}

export function completeNotificationMarkRead(
  state: NotificationMarkReadState,
  request: NotificationMarkReadRequest,
): NotificationMarkReadState {
  if (state.pendingRequest !== request) return state
  return initialNotificationMarkReadState
}

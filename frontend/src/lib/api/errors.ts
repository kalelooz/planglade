export type ApiErrorKind =
  | 'unauthenticated'
  | 'onboarding_required'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'temporary'
  | 'unknown'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | null
  readonly requestId?: string

  constructor(
    kind: ApiErrorKind,
    status: number | null,
    message: string,
    requestId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
    this.requestId = requestId
  }
}

export function apiErrorKind(status: number, code?: string): ApiErrorKind {
  if (status === 401) return 'unauthenticated'
  if (status === 409 && code === 'ONBOARDING_REQUIRED') return 'onboarding_required'
  if (status === 403) return 'forbidden'
  if (status === 404 || status === 410) return 'not_found'
  if (status === 409) return 'conflict'
  if (status === 400 || status === 422) return 'validation'
  if (status === 429 || status >= 500) return 'temporary'
  return 'unknown'
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  if (error instanceof DOMException && error.name === 'AbortError') throw error
  return new ApiError('temporary', null, 'PlanGlade is temporarily unavailable.')
}

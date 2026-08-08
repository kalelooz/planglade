import type { ZodType } from 'zod'
import { ApiError, apiErrorKind, toApiError } from '@/lib/api/errors'

type ErrorPayload = { code?: unknown; error?: unknown }

function requestIdFrom(response: Response) {
  const value = response.headers.get('x-request-id')
  return value && /^[a-zA-Z0-9._:-]{1,128}$/.test(value) ? value : undefined
}

async function responseJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new ApiError('temporary', response.status, 'PlanGlade returned an invalid response.', requestIdFrom(response))
  }
}

export async function getJson<T>(path: `/${string}`, schema: ZodType<T>, signal?: AbortSignal): Promise<T> {
  return requestJson(path, { method: 'GET', signal }, schema)
}

export async function sendJson<T>(
  path: `/${string}`,
  method: 'POST' | 'PUT' | 'PATCH',
  body: unknown,
  schema: ZodType<T>,
  signal?: AbortSignal,
): Promise<T> {
  return requestJson(path, {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    signal,
  }, schema)
}

export async function deleteJson<T>(path: `/${string}`, schema: ZodType<T>, signal?: AbortSignal): Promise<T> {
  return requestJson(path, { method: 'DELETE', signal }, schema)
}

async function requestJson<T>(path: `/${string}`, init: RequestInit, schema: ZodType<T>): Promise<T> {
  try {
    const response = await fetch(path, {
      ...init,
      credentials: 'include',
      cache: 'no-store',
      headers: { Accept: 'application/json', ...init.headers },
    })
    const payload = await responseJson(response)
    if (!response.ok) {
      const error = payload as ErrorPayload
      const code = typeof error.code === 'string' ? error.code : undefined
      throw new ApiError(
        apiErrorKind(response.status, code),
        response.status,
        response.status >= 500 ? 'PlanGlade is temporarily unavailable.' : 'The request could not be completed.',
        requestIdFrom(response),
      )
    }
    const parsed = schema.safeParse(payload)
    if (!parsed.success) {
      throw new ApiError('temporary', response.status, 'PlanGlade returned an invalid response.', requestIdFrom(response))
    }
    return parsed.data
  } catch (error) {
    throw toApiError(error)
  }
}

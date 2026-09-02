import type { QueryClient, QueryKey } from '@tanstack/react-query'

import { toApiError } from '@/lib/api/errors'

export function reloadCollaborativeQueryOnConflict(
  queryClient: Pick<QueryClient, 'invalidateQueries'>,
  error: unknown,
  queryKey: QueryKey,
) {
  if (toApiError(error).kind !== 'conflict') return Promise.resolve()
  return queryClient.invalidateQueries({ queryKey, refetchType: 'active' })
}

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dataMode } from '@/lib/data-mode'
import type { BackendSavedView } from '@/lib/api/contracts'
import {
  createSavedView,
  deleteSavedView,
  getSavedViews,
  updateSavedView,
  type SavedViewInput,
} from '@/lib/api/saved-views'

const REFERENCE_KEY = 'planglade-saved-views-v1'

function loadReferenceViews(): BackendSavedView[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(REFERENCE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function referenceView(input: SavedViewInput): BackendSavedView {
  const now = new Date().toISOString()
  return {
    id: `view-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    workspaceId: input.workspaceId,
    projectId: input.projectId ?? null,
    createdById: 'reference-user',
    name: input.name,
    layout: input.layout,
    groupBy: input.groupBy ?? null,
    orderBy: input.orderBy ?? null,
    filters: input.filters ?? null,
    display: input.display ?? null,
    isDefault: input.isDefault,
    createdAt: now,
    updatedAt: now,
  }
}

export function useSavedViews(workspaceId: string | null) {
  const queryClient = useQueryClient()
  const [referenceViews, setReferenceViews] = useState<BackendSavedView[]>(loadReferenceViews)
  useEffect(() => {
    if (dataMode === 'reference') localStorage.setItem(REFERENCE_KEY, JSON.stringify(referenceViews))
  }, [referenceViews])

  const query = useQuery({
    queryKey: ['saved-views', workspaceId],
    queryFn: ({ signal }) => getSavedViews(workspaceId!, signal),
    enabled: dataMode === 'api' && !!workspaceId,
    retry: false,
  })

  const createMutation = useMutation({
    mutationFn: (input: SavedViewInput) => createSavedView(input),
    onSuccess: (created) => queryClient.setQueryData<BackendSavedView[]>(['saved-views', workspaceId], (current = []) => [created, ...current]),
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<SavedViewInput> }) => updateSavedView(workspaceId!, id, patch),
    onSuccess: (updated, variables) => queryClient.setQueryData<BackendSavedView[]>(['saved-views', workspaceId], (current = []) => current.map((view) => view.id === updated.id ? updated : variables.patch.isDefault ? { ...view, isDefault: false } : view)),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSavedView(workspaceId!, id),
    onSuccess: (_result, id) => queryClient.setQueryData<BackendSavedView[]>(['saved-views', workspaceId], (current = []) => current.filter((view) => view.id !== id)),
  })

  return useMemo(() => ({
    views: dataMode === 'reference' ? referenceViews : query.data ?? [],
    loading: dataMode === 'api' && query.isLoading,
    error: dataMode === 'api' && query.isError,
    pending: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
    create: async (input: SavedViewInput) => {
      if (dataMode === 'reference') {
        const created = referenceView(input)
        setReferenceViews((current) => [created, ...current])
        return created
      }
      return createMutation.mutateAsync(input)
    },
    update: async (id: string, patch: Partial<SavedViewInput>) => {
      if (dataMode === 'reference') {
        let updated: BackendSavedView | undefined
        setReferenceViews((current) => current.map((view) => {
          if (patch.isDefault && view.id !== id) return { ...view, isDefault: false }
          if (view.id !== id) return view
          updated = { ...view, ...patch, projectId: patch.projectId ?? view.projectId, updatedAt: new Date().toISOString() }
          return updated
        }))
        return updated
      }
      return updateMutation.mutateAsync({ id, patch })
    },
    remove: async (id: string) => {
      if (dataMode === 'reference') {
        setReferenceViews((current) => current.filter((view) => view.id !== id))
        return
      }
      await deleteMutation.mutateAsync(id)
    },
  }), [createMutation, deleteMutation, query.data, query.isError, query.isLoading, referenceViews, updateMutation])
}

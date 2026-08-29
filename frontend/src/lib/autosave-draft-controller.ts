export type AutosaveDraftSnapshot = Readonly<{
  value: string
  dirty: boolean
  saving: boolean
  error: string | null
}>

export interface AutosaveDraftController {
  edit(value: string): void
  flush(): Promise<boolean>
  getSnapshot(): AutosaveDraftSnapshot
  reset(): void
  setCanEdit(canEdit: boolean): void
  subscribe(listener: () => void): () => void
  syncServerValue(value: string): void
}

type AutosaveOptions = {
  initialValue: string
  save: (value: string) => Promise<boolean>
  canEdit?: boolean
  delayMs?: number
  valid?: (value: string) => boolean
  normalize?: (value: string) => string
  invalidMessage?: string
  saveErrorMessage?: string
}

export function createAutosaveDraftController({
  initialValue,
  save,
  canEdit: initialCanEdit = true,
  delayMs = 450,
  valid = () => true,
  normalize = (value) => value,
  invalidMessage = 'This value cannot be saved.',
  saveErrorMessage = 'This change was not saved. Edit again to retry.',
}: AutosaveOptions): AutosaveDraftController {
  let canEdit = initialCanEdit
  let baseValue = normalize(initialValue)
  let value = initialValue
  let dirty = false
  let error: string | null = null
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let snapshot: AutosaveDraftSnapshot = { value, dirty, saving: false, error }
  const listeners = new Set<() => void>()
  const pending = new Map<number, Promise<boolean>>()

  const publish = () => {
    snapshot = { value, dirty, saving: pending.size > 0, error }
    listeners.forEach((listener) => listener())
  }
  const cancelTimer = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  const currentIsSavable = () => canEdit && dirty && valid(value)

  const performSave = () => {
    cancelTimer()
    if (!currentIsSavable()) {
      if (dirty && !valid(value)) {
        error = invalidMessage
        publish()
      }
      return Promise.resolve(!dirty)
    }

    const requestGeneration = generation
    const requestValue = normalize(value)
    const existing = pending.get(requestGeneration)
    if (existing) return existing

    const promise = (async () => {
      let saved = false
      try {
        saved = await Promise.resolve().then(() => save(requestValue))
      } catch {
        saved = false
      } finally {
        pending.delete(requestGeneration)
      }

      if (saved) baseValue = requestValue
      dirty = normalize(value) !== baseValue
      if (requestGeneration === generation) {
        error = saved ? null : saveErrorMessage
      }
      publish()

      if (requestGeneration !== generation && currentIsSavable()) {
        void performSave()
      }
      return saved
    })()
    pending.set(requestGeneration, promise)
    publish()
    return promise
  }

  const flush = async () => {
    cancelTimer()
    while (true) {
      if (pending.size > 0) {
        await Promise.all([...pending.values()])
        continue
      }
      if (!dirty) return true
      if (!canEdit) return false
      if (!valid(value)) {
        error = invalidMessage
        publish()
        return false
      }
      if (!(await performSave())) return false
    }
  }

  const schedule = () => {
    cancelTimer()
    if (!currentIsSavable()) return
    timer = setTimeout(() => { void performSave() }, delayMs)
  }

  return {
    edit(nextValue) {
      value = nextValue
      generation += 1
      dirty = normalize(value) !== baseValue
      error = null
      schedule()
      publish()
    },
    flush,
    getSnapshot() {
      return snapshot
    },
    reset() {
      cancelTimer()
      generation += 1
      value = baseValue
      dirty = false
      error = null
      publish()
    },
    setCanEdit(nextCanEdit) {
      canEdit = nextCanEdit
      if (canEdit) schedule()
      else cancelTimer()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    syncServerValue(nextValue) {
      baseValue = normalize(nextValue)
      if (!dirty) value = nextValue
      dirty = normalize(value) !== baseValue
      if (!dirty) error = null
      schedule()
      publish()
    },
  }
}

import {
  WORKSPACE_PATHS,
  canonicalizeLegacyWorkspaceLocation,
  withPreservedLocation,
} from './workspace-routes'

const ENTRY_PATHS = new Set(['/auth/login', '/auth/recover', '/login', '/setup', '/onboarding', '/invite/review'])

function hasControlCharacters(value: string) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0
    return codePoint <= 31 || codePoint === 127
  })
}

export function normalizeWorkspaceDestination(value: string | null | undefined, fallback = WORKSPACE_PATHS.home) {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    /%2f|%5c/i.test(value) ||
    hasControlCharacters(value)
  ) return fallback

  try {
    const parsed = new URL(value, 'http://planglade.local')
    const entryPath = parsed.pathname.length > 1 ? parsed.pathname.replace(/\/+$/, '') : parsed.pathname
    if (parsed.origin !== 'http://planglade.local' || ENTRY_PATHS.has(entryPath)) return fallback
    if (entryPath === '/') return withPreservedLocation(WORKSPACE_PATHS.home, parsed)
    return canonicalizeLegacyWorkspaceLocation(parsed.pathname, parsed.search, parsed.hash) ??
      `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}

export function authLoginHref(destination: string) {
  return `/auth/login?next=${encodeURIComponent(normalizeWorkspaceDestination(destination))}`
}

export function currentWorkspaceDestination() {
  return normalizeWorkspaceDestination(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  )
}

export type LegacySearchParams = Record<string, string | string[] | undefined>

export function buildLegacyProjectsDestination(searchParams: LegacySearchParams) {
  const projectValue = searchParams.project
  const projectId = Array.isArray(projectValue) ? projectValue[0] : projectValue
  const remaining = new URLSearchParams()

  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "project" || value === undefined) continue

    for (const item of Array.isArray(value) ? value : [value]) {
      remaining.append(key, item)
    }
  }

  const destination = projectId
    ? `/app/projects/${encodeURIComponent(projectId)}`
    : "/app/projects"
  const query = remaining.toString()

  return query ? `${destination}?${query}` : destination
}

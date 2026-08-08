type MentionMember = {
  userId: string
  user: {
    name: string | null
    email: string
  }
}

function normalizeHandle(value: string) {
  return value.trim().toLowerCase()
}

function tokensFromName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .split(/[\s._-]+/)
    .filter(Boolean)
}

function buildHandleMap(members: MentionMember[]) {
  const byHandle = new Map<string, string>()

  for (const member of members) {
    const handles = new Set<string>()
    const emailLocal = member.user.email.split("@")[0] ?? ""
    if (emailLocal) handles.add(normalizeHandle(emailLocal))
    handles.add(normalizeHandle(member.userId))

    if (member.user.name) {
      const tokens = tokensFromName(member.user.name)
      if (tokens[0]) handles.add(tokens[0])
      if (tokens.length >= 2) {
        handles.add(tokens.join(""))
        handles.add(tokens.join("."))
        handles.add(`${tokens[0]}.${tokens[tokens.length - 1]}`)
      }
    }

    for (const handle of handles) {
      if (!handle) continue
      if (!byHandle.has(handle)) {
        byHandle.set(handle, member.userId)
      }
    }
  }

  return byHandle
}

export function extractMentionUserIds(body: string, members: MentionMember[]) {
  const byHandle = buildHandleMap(members)
  const mentionRegex = /@([a-zA-Z0-9._-]{2,60})/g
  const mentioned = new Set<string>()

  for (const match of body.matchAll(mentionRegex)) {
    const handle = normalizeHandle(match[1] ?? "")
    const userId = byHandle.get(handle)
    if (userId) mentioned.add(userId)
  }

  return Array.from(mentioned)
}

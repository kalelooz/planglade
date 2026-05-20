export type ServerSessionPayload = {
  user: { id: string; email: string; name: string | null }
  workspace: { id: string; slug: string; name: string }
  members?: Array<{ id: string; name: string; email: string; role: string }>
  authMode?: string
}

export async function getServerSession(): Promise<ServerSessionPayload> {
  const response = await fetch("/api/auth/session", { cache: "no-store" })
  if (!response.ok) {
    throw new Error("Failed to bootstrap session")
  }
  return (await response.json()) as ServerSessionPayload
}

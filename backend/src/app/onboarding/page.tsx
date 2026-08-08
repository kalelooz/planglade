"use client"

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, CheckSquare, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { buildSessionAuthHeaders } from "@/lib/server-session-client"

function normalizeWorkspaceSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingPageContent />
    </Suspense>
  )
}

function OnboardingPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = useMemo(() => searchParams.get("next") || "/app", [searchParams])

  const [checking, setChecking] = useState(true)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        const headers = await buildSessionAuthHeaders()
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          headers,
        })

        if (!active) return

        if (response.status === 401) {
          router.replace(`/login?next=${encodeURIComponent("/onboarding")}`)
          return
        }

        if (response.ok) {
          router.replace(nextPath)
          return
        }

        if (response.status !== 409) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string }
          setError(payload.error ?? "Unable to verify onboarding state")
        }
      } catch {
        if (active) setError("Failed to check onboarding status")
      } finally {
        if (active) setChecking(false)
      }
    })()

    return () => {
      active = false
    }
  }, [nextPath, router])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (trimmedName.length < 2) {
      setError("Workspace name must be at least 2 characters")
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const headers = await buildSessionAuthHeaders()
      const response = await fetch("/api/workspace/onboarding", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          name: trimmedName,
          ...(slug.trim() ? { slug: normalizeWorkspaceSlug(slug) } : {}),
        }),
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string }
        setError(payload.error ?? "Failed to create workspace")
        return
      }

      router.replace(nextPath)
    } catch {
      setError("Failed to create workspace")
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 text-foreground">
        <div className="relative flex items-center gap-2 rounded-lg border border-border/80 bg-card px-5 py-3 text-sm text-muted-foreground shadow-xs">
          <Loader2 className="size-4 animate-spin text-foreground" />
          Checking your workspace...
        </div>
      </div>
    )
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4 text-foreground">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="rounded-lg border border-border/80 bg-card p-7 shadow-xs">
          <div className="mb-7 flex flex-col items-center gap-4">
            <div className="flex size-12 items-center justify-center rounded-lg border border-border/80 bg-muted">
              <CheckSquare className="size-6 text-foreground" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">PlanGlade</h1>
              <p className="mt-1 text-sm text-muted-foreground">A focused workspace for projects.</p>
            </div>
          </div>

          <div className="mb-5 text-center">
            <h2 className="text-lg font-semibold text-foreground">Set up your workspace</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Create a calm place for your projects, tasks, notes, and planning.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="workspace-name" className="text-sm font-medium">
                Workspace name
              </label>
              <input
                id="workspace-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="My projects"
                className="h-10 w-full rounded-md border border-border/80 bg-white px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
                autoFocus
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="workspace-slug" className="text-sm font-medium">
                Workspace URL slug (optional)
              </label>
              <input
                id="workspace-slug"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
                placeholder="my-projects"
                className="h-10 w-full rounded-md border border-border/80 bg-white px-3 text-sm outline-none transition focus:border-ring focus:ring-2 focus:ring-ring/20"
              />
              <p className="text-xs text-muted-foreground">Optional. Use lowercase letters, numbers, and dashes.</p>
            </div>

            {error ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              disabled={submitting}
              className="h-10 w-full gap-2 bg-primary text-sm font-medium text-primary-foreground hover:bg-zinc-800 disabled:opacity-60"
            >
              {submitting ? "Creating workspace..." : "Continue"}
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
            </Button>
          </form>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground">
            You can adjust this later in Settings.
          </p>
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Built for solo project clarity first, with collaboration foundations ready when needed.
        </p>
      </motion.div>
    </div>
  )
}

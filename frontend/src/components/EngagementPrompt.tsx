import { useState } from 'react'
import { Link } from 'react-router'
import { Github, MessageSquareText, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ENGAGEMENT_PROMPT_DISMISS_MS, resolveEngagementPrompt } from '@/lib/engagement-prompt'

function readNextAt(storageKey: string) {
  const stored = Number(localStorage.getItem(storageKey))
  return Number.isFinite(stored) && stored > 0 ? stored : null
}

export function EngagementPrompt({
  eligible,
  storageKey,
  plansHref,
}: {
  eligible: boolean
  storageKey: string
  plansHref: string
}) {
  const [now] = useState(Date.now)
  const [dismissal, setDismissal] = useState(() => ({ storageKey, nextAt: readNextAt(storageKey) }))
  const nextAt = dismissal.storageKey === storageKey ? dismissal.nextAt : readNextAt(storageKey)
  const visible = resolveEngagementPrompt({ eligible, nextAt, now }).show

  if (!visible) return null

  const dismiss = () => {
    const nextAt = Date.now() + ENGAGEMENT_PROMPT_DISMISS_MS
    localStorage.setItem(storageKey, String(nextAt))
    setDismissal({ storageKey, nextAt })
  }

  return (
    <aside
      className="fixed inset-x-3 bottom-3 z-40 ml-auto max-w-[340px] rounded-xl border border-border/80 bg-card p-4 text-card-foreground shadow-[0_0_0_1px_hsl(var(--foreground)/0.03),0_12px_32px_hsl(var(--foreground)/0.12)] sm:inset-x-auto sm:bottom-4 sm:right-4"
      aria-labelledby="engagement-prompt-title"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary" aria-hidden="true">
          <Sparkles className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p id="engagement-prompt-title" className="text-sm font-semibold tracking-tight">Enjoying PlanGlade?</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Keep using Free, or see what Solo and Teams add when you need more room.</p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" className="-mr-1 -mt-1" aria-label="Dismiss PlanGlade options" onClick={dismiss}>
          <X className="size-4" aria-hidden="true" />
        </Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button asChild size="sm" onClick={dismiss}>
          <Link to={plansHref}>View plans</Link>
        </Button>
        <Button asChild size="sm" variant="ghost" onClick={dismiss}>
          <a href="mailto:support@planglade.com?subject=PlanGlade%20feedback"><MessageSquareText className="size-4" aria-hidden="true" /> Feedback</a>
        </Button>
        <Button asChild size="sm" variant="ghost" onClick={dismiss}>
          <a href="https://github.com/kalelooz/planglade" target="_blank" rel="noreferrer"><Github className="size-4" aria-hidden="true" /> Star</a>
        </Button>
      </div>
    </aside>
  )
}

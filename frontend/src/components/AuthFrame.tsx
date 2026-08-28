import type { ReactNode } from 'react'
import { ArrowLeft, Inbox, ListTodo, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router'
import { PlanGladeBrand } from '@/components/PlanGladeBrand'
import { WORKSPACE_PATHS } from '@/lib/workspace-routes'

export function AuthFrame({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <main id="main" className="min-h-dvh bg-muted/45 px-4 py-6 sm:grid sm:place-items-center sm:p-8">
      <div className={compact ? 'mx-auto w-full max-w-xl' : 'mx-auto grid w-full max-w-5xl overflow-hidden rounded-xl border border-border bg-card shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.86fr)]'}>
        <section className={compact ? 'rounded-xl border border-border bg-card p-6 shadow-sm sm:p-10' : 'flex min-w-0 flex-col p-6 sm:p-10'}>
          <PlanGladeBrand />
          <div className={compact ? 'mt-8' : 'my-auto py-10'}>{children}</div>
          {!compact && (
            <Link to={WORKSPACE_PATHS.home} className="inline-flex min-h-11 w-fit items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Back to workspace
            </Link>
          )}
        </section>
        {!compact && (
          <aside aria-labelledby="auth-context-title" className="border-t border-border bg-primary p-6 text-primary-foreground sm:p-10 lg:border-l lg:border-t-0">
            <div className="flex h-full flex-col">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground/60">A calm clearing</p>
                <h2 id="auth-context-title" className="mt-3 text-2xl font-semibold tracking-tight text-balance">Start with the work in front of you.</h2>
                <p className="mt-3 text-sm leading-6 text-primary-foreground/65 text-pretty">Capture, plan, and keep project context together without turning daily work into administration.</p>
              </div>
              <div className="mt-10 grid gap-3 lg:mt-auto">
                {[
                  [Inbox, 'Capture first', 'Send loose work to Inbox before it disappears.'],
                  [ListTodo, 'One source of truth', 'A task can appear in list, board, and calendar without duplication.'],
                  [ShieldCheck, 'Your workspace', 'Local sign-in and self-hosting work without optional providers.'],
                ].map(([Icon, title, detail]) => {
                  const ItemIcon = Icon as typeof Inbox
                  return (
                    <article key={String(title)} className="rounded-lg border border-primary-foreground/10 bg-primary-foreground/[0.055] p-4">
                      <div className="flex items-start gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary-foreground/10"><ItemIcon className="size-4" aria-hidden="true" /></span>
                        <div><h3 className="text-sm font-semibold">{String(title)}</h3><p className="mt-1 text-sm leading-5 text-primary-foreground/60">{String(detail)}</p></div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </div>
          </aside>
        )}
      </div>
    </main>
  )
}

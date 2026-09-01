import { Check, ExternalLink, Sprout, TreePine, Trees } from 'lucide-react'
import { PageContainer } from '@/components/bits'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

const plans = [
  {
    name: 'Free',
    description: 'A complete personal workspace you can run locally or self-host.',
    icon: Sprout,
    features: ['Projects, tasks, notes, and calendar', 'Local-first reference workspace', 'MIT-licensed self-hosting'],
  },
  {
    name: 'Solo',
    description: 'Managed hosting for one person who wants PlanGlade ready everywhere.',
    icon: TreePine,
    features: ['Everything in Free', 'Managed sign-in and cloud sync', 'Portable workspace exports'],
  },
  {
    name: 'Teams',
    description: 'A shared managed workspace for people planning and delivering together.',
    icon: Trees,
    features: ['Everything in Solo', 'Invitations and workspace roles', 'Assignments, comments, and notifications'],
  },
] as const

export default function Plans() {
  return (
    <PageContainer width="wide" className="py-6 sm:py-8">
      <header className="max-w-2xl">
        <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Plans</p>
        <h1 className="pg-page-title mt-2 text-balance">Keep your work calm as it grows.</h1>
        <p className="pg-page-kicker mt-2 max-w-xl text-pretty">
          Free remains a complete personal workspace. Solo and Teams add managed hosting when you want PlanGlade ready without running it yourself.
        </p>
      </header>

      <section aria-labelledby="current-plan-title" className="mt-7 rounded-xl border border-border/70 bg-secondary/45 px-4 py-4 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-5">
        <div>
          <p id="current-plan-title" className="text-sm font-semibold">Your current edition: Free</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">No trial clock and no payment method required.</p>
        </div>
        <span className="mt-3 inline-flex rounded-full bg-background px-2.5 py-1 text-xs font-medium shadow-[inset_0_0_0_1px_hsl(var(--border))] sm:mt-0">Included</span>
      </section>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {plans.map((plan, index) => (
          <Card key={plan.name} className="gap-5 border-border/70 py-5 shadow-[0_1px_2px_hsl(var(--foreground)/0.04)]">
            <CardHeader className="gap-3 px-5">
              <span className="grid size-9 place-items-center rounded-lg bg-secondary" aria-hidden="true">
                <plan.icon className="size-4" />
              </span>
              <div>
                <CardTitle className="text-base tracking-tight">{plan.name}</CardTitle>
                <CardDescription className="mt-1.5 min-h-10 text-pretty text-xs leading-5">{plan.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="px-5">
              <ul className="space-y-2.5 text-[13px]">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5">
                    <Check className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter className="mt-auto px-5">
              {index === 0 ? (
                <Button type="button" variant="outline" className="w-full" disabled>Current plan</Button>
              ) : (
                <Button asChild variant={index === 1 ? 'default' : 'outline'} className="w-full">
                  <a href="https://planglade.com/#pricing" target="_blank" rel="noreferrer">See managed plans <ExternalLink className="size-4" aria-hidden="true" /></a>
                </Button>
              )}
            </CardFooter>
          </Card>
        ))}
      </div>

      <p className="mt-5 text-xs leading-5 text-muted-foreground">
        Self-hosting stays free under the MIT license. Managed plan availability is shown on the PlanGlade website.
      </p>
    </PageContainer>
  )
}

import { PlanGladeBrand } from '@/components/PlanGladeBrand'
import { landingNavLinks } from '@/components/landing/content'
import { landingEdition } from '@/components/landing/edition'

export function LandingFooter() {
  return (
    <footer className="border-t border-[hsl(var(--landing-rule))]">
      <div className="landing-shell grid gap-8 py-8 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <PlanGladeBrand className="text-sm" />
          <p className="mt-3 max-w-sm text-xs leading-5 text-[hsl(var(--landing-quiet))]">A calm, open-source workspace for tasks, projects, notes, schedules, and the connections between them.</p>
        </div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <a href="#product" className="min-h-11 content-center text-[hsl(var(--landing-quiet))] hover:text-[hsl(var(--landing-ink))]">Product</a>
          <a href={landingEdition.primaryHref} className="min-h-11 content-center text-[hsl(var(--landing-quiet))] hover:text-[hsl(var(--landing-ink))]">{landingEdition.signInLabel}</a>
          <a href="https://github.com/kalelooz/planglade" target="_blank" rel="noreferrer" className="min-h-11 content-center text-[hsl(var(--landing-quiet))] hover:text-[hsl(var(--landing-ink))]">GitHub</a>
          {landingNavLinks.filter((link) => link.href === '#faq').map((link) => <a key={link.href} href={link.href} className="min-h-11 content-center text-[hsl(var(--landing-quiet))] hover:text-[hsl(var(--landing-ink))]">{link.label}</a>)}
        </nav>
      </div>
      <div className="landing-shell flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(var(--landing-rule))] py-4 text-xs leading-5 text-[hsl(var(--landing-quiet))]">
        <p>PlanGlade is available under GNU AGPL v3.0.</p>
        {landingEdition.legalLinks.length > 0 && (
          <nav aria-label="Legal links" className="flex flex-wrap gap-4">
            {landingEdition.legalLinks.map((link) => <a key={link.href} href={link.href} className="underline underline-offset-4">{link.label}</a>)}
          </nav>
        )}
      </div>
    </footer>
  )
}

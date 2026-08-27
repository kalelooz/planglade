import { ArrowUpRight, Check, Database, GitFork, LogIn, UserRound } from 'lucide-react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { landingFaqItems } from '@/components/landing/content'
import { landingEdition, type LandingTrustDetail } from '@/components/landing/edition'

const trustIcons = {
  workspace: UserRound,
  'sign-in': LogIn,
  persistence: Database,
  'open-source': GitFork,
} satisfies Record<LandingTrustDetail['kind'], typeof UserRound>

export function TrustAndOpenSource() {
  return (
    <>
      <section aria-labelledby="trust-title" className="landing-section landing-shell border-t border-[hsl(var(--landing-rule))]">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
          <div>
            <p className="landing-kicker">FACTS BEFORE PROMISES</p>
            <h2 id="trust-title" className="landing-section-title mt-3">Built for a personal workspace, with the product boundaries stated plainly.</h2>
            <p className="landing-section-copy mt-4">{landingEdition.trustIntro}</p>
          </div>
          <dl className="divide-y divide-[hsl(var(--landing-rule))] border-y border-[hsl(var(--landing-rule))]">
            {landingEdition.trustDetails.map((detail) => {
              const Icon = trustIcons[detail.kind]
              return (
                <div key={detail.label} className="grid gap-2 py-4 sm:grid-cols-[11rem_1fr]">
                  <dt className="flex items-center gap-2 text-sm font-semibold"><Icon className="size-4" aria-hidden="true" />{detail.label}</dt>
                  <dd className="text-sm leading-6 text-[hsl(var(--landing-quiet))]">{detail.description}</dd>
                </div>
              )
            })}
            <div className="grid gap-2 py-4 sm:grid-cols-[11rem_1fr]">
              <dt className="flex items-center gap-2 text-sm font-semibold"><Check className="size-4" aria-hidden="true" />Task model</dt>
              <dd className="text-sm leading-6 text-[hsl(var(--landing-quiet))]">One task record carries its project, status, dates, priority, notes, and relationships into every view.</dd>
            </div>
          </dl>
        </div>
      </section>

      <section id="open-source" aria-labelledby="open-source-title" className="landing-section landing-shell scroll-mt-24">
        <div className="landing-open-source">
          <div>
            <p className="landing-kicker">OPEN SOURCE</p>
            <h2 id="open-source-title" className="landing-section-title mt-3">Read the source. Run it yourself. Help improve the workshop.</h2>
            <p className="landing-section-copy mt-4">The public PlanGlade repository contains the complete self-hosted product and user-facing documentation. It is available under the GNU Affero General Public License v3.0.</p>
          </div>
          <div className="flex flex-col items-start gap-3 lg:items-end">
            <Button asChild size="lg" className="min-h-11 px-5">
              <a href="https://github.com/kalelooz/planglade" target="_blank" rel="noreferrer">View the source <ArrowUpRight className="size-4" aria-hidden="true" /></a>
            </Button>
            <a className="inline-flex min-h-11 items-center text-sm font-medium underline decoration-[hsl(var(--landing-rule))] underline-offset-4 hover:decoration-current" href="https://github.com/kalelooz/planglade/blob/main/backend/docs/SELF_HOSTING.md" target="_blank" rel="noreferrer">Read the self-hosting guide</a>
          </div>
        </div>
      </section>
    </>
  )
}

export function LandingFAQ() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="landing-section landing-shell scroll-mt-24 border-t border-[hsl(var(--landing-rule))]">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.65fr)_minmax(0,1.35fr)]">
        <div><p className="landing-kicker">FAQ</p><h2 id="faq-title" className="landing-section-title mt-3">A few practical answers.</h2></div>
        <Accordion type="single" collapsible className="border-t border-[hsl(var(--landing-rule))]">
          {landingFaqItems.map((item, index) => (
            <AccordionItem key={item.question} value={`faq-${index}`} className="border-[hsl(var(--landing-rule))]">
              <AccordionTrigger className="min-h-14 py-4 text-left text-[15px] hover:no-underline">{item.question}</AccordionTrigger>
              <AccordionContent className="max-w-2xl pb-5 text-sm leading-6 text-[hsl(var(--landing-quiet))]">{item.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}

import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FilmDialog } from '@/components/landing/FilmDialog'
import { LandingFAQ, TrustAndOpenSource } from '@/components/landing/LandingFAQ'
import { LandingFooter } from '@/components/landing/LandingFooter'
import { LandingHeader } from '@/components/landing/LandingHeader'
import { ProductStory } from '@/components/landing/ProductStory'
import { landingEdition } from '@/components/landing/edition'
import { HomeWorkspacePreview } from '@/components/landing/WorkspacePreviews'

export default function Landing() {
  return (
    <div className="pg-landing">
      <a href="#main-content" className="landing-skip-link">Skip to content</a>
      <LandingHeader />

      <main id="main-content">
        <section aria-labelledby="landing-hero-title" className="landing-editorial-hero landing-shell">
          <div className="max-w-4xl">
            <p className="landing-kicker">A WORKSPACE FOR CLARITY</p>
            <h1 id="landing-hero-title" className="landing-hero-title">Your work, without the work of managing it.</h1>
            <p className="landing-hero-support">Capture loose thoughts, turn them into clear tasks, and see the same work as a list, board, timeline, calendar, or connection map—without duplicating anything.</p>
            <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="min-h-11 px-5">
                <a href={landingEdition.primaryHref}>{landingEdition.primaryCtaLabel} <ArrowRight className="size-4" aria-hidden="true" /></a>
              </Button>
              <FilmDialog />
            </div>
            <p className="mt-4 max-w-xl text-xs leading-5 text-[hsl(var(--landing-quiet))]">{landingEdition.microcopy}</p>
          </div>
          <div className="mt-12 sm:mt-16">
            <HomeWorkspacePreview />
          </div>
        </section>

        <ProductStory />
        <TrustAndOpenSource />
        <LandingFAQ />

        <section aria-labelledby="final-cta-title" className="landing-final-cta">
          <div className="landing-shell py-16 text-center sm:py-20">
            <p className="landing-kicker">START WITH WHAT IS ALREADY THERE</p>
            <h2 id="final-cta-title" className="landing-section-title mx-auto mt-3 max-w-3xl">Start with the work already in front of you.</h2>
            <p className="landing-section-copy mx-auto mt-4 max-w-xl">Capture one real task, give it context when you are ready, and let every view stay in step.</p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="min-h-11 px-5">
                <a href={landingEdition.primaryHref}>{landingEdition.primaryCtaLabel} <ArrowRight className="size-4" aria-hidden="true" /></a>
              </Button>
              <Button asChild size="lg" variant="outline" className="min-h-11 px-5">
                <a href="https://github.com/kalelooz/planglade" target="_blank" rel="noreferrer">Explore the open-source edition</a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-[hsl(var(--landing-quiet))]">Personal workspaces only. Team workspaces and invitations are planned, not available.</p>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}

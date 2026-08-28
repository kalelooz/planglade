import { useState } from 'react'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { landingEdition } from '@/components/landing/edition'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export function FilmDialog() {
  const [open, setOpen] = useState(false)
  const [mediaUnavailable, setMediaUnavailable] = useState(false)
  const productFilm = landingEdition.productFilm

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="lg" className="landing-secondary-cta min-h-11 bg-transparent px-5">
          <Play className="size-4" aria-hidden="true" />
          Watch the 30-second tour
        </Button>
      </DialogTrigger>
      <DialogContent className="pg-landing max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto border-[hsl(var(--landing-rule))] bg-[hsl(var(--landing-paper))] p-0 text-[hsl(var(--landing-ink))] sm:max-w-3xl">
        <DialogHeader className="border-b border-[hsl(var(--landing-rule))] px-5 py-5 pr-12 text-left sm:px-6">
          <DialogTitle className="text-lg">A short tour of the living project ledger</DialogTitle>
          <DialogDescription id="product-film-description" className="max-w-2xl text-[hsl(var(--landing-quiet))]">
            See one captured thought become a task, then follow that same task through PlanGlade’s useful views.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 p-4 sm:p-6">
          <div className="overflow-hidden rounded-lg border border-[hsl(var(--landing-rule))] bg-[hsl(var(--landing-soft))]">
            {open && productFilm && !mediaUnavailable ? (
              <video
                controls
                preload="metadata"
                poster={productFilm.poster}
                aria-label="PlanGlade 30-second product tour"
                aria-describedby="product-film-description product-film-transcript"
                className="aspect-video w-full bg-[hsl(var(--landing-ink))] object-contain"
                onError={() => setMediaUnavailable(true)}
              >
                <source src={productFilm.src} type="video/mp4" />
                <track kind="captions" src={productFilm.captions} srcLang="en" label="English" default />
                Your browser cannot play this video. The full tour is available as text below.
              </video>
            ) : (
              <div className="flex aspect-video items-center justify-center px-6 text-center text-sm text-[hsl(var(--landing-quiet))]" role="status">
                The film is not included in this build. The complete tour is available as text below.
              </div>
            )}
          </div>

          <section id="product-film-transcript" aria-labelledby="product-film-transcript-title" className="rounded-lg border border-[hsl(var(--landing-rule))] p-4 sm:p-5">
            <h3 id="product-film-transcript-title" className="text-sm font-semibold">Text tour and transcript</h3>
            <ol className="mt-3 grid gap-3 text-sm leading-6 text-[hsl(var(--landing-quiet))] sm:grid-cols-3">
              <li><strong className="block text-[hsl(var(--landing-ink))]">1. Capture</strong>Write “Send homepage draft to Mara tomorrow #Client Refresh.” PlanGlade recognizes the date and project.</li>
              <li><strong className="block text-[hsl(var(--landing-ink))]">2. Clarify</strong>The thought becomes a task with a clear title, project, Inbox state, and due date.</li>
              <li><strong className="block text-[hsl(var(--landing-ink))]">3. Change the view</strong>Open List, Board, Timeline, Calendar, or Connections. It is still the same task.</li>
            </ol>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

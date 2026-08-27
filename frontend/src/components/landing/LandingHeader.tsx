import { Menu } from 'lucide-react'
import { PlanGladeBrand } from '@/components/PlanGladeBrand'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { landingNavLinks } from '@/components/landing/content'
import { landingEdition } from '@/components/landing/edition'

export function LandingHeader() {
  return (
    <header className="landing-header">
      <div className="landing-shell flex h-16 items-center justify-between gap-4">
        <PlanGladeBrand className="text-[15px]" />

        <nav aria-label="Primary navigation" className="hidden items-center gap-1 md:flex">
          {landingNavLinks.map((link) => (
            <a key={link.href} href={link.href} className="landing-nav-link">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost" className="min-h-11 px-3">
            <a href={landingEdition.primaryHref}>{landingEdition.signInLabel}</a>
          </Button>
          <Button asChild className="min-h-11 px-4">
            <a href={landingEdition.primaryHref}>{landingEdition.primaryCtaLabel}</a>
          </Button>
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="icon" className="size-11 md:hidden" aria-label="Open navigation">
              <Menu className="size-5" aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent className="pg-landing w-[min(22rem,calc(100vw-1rem))] border-l-[hsl(var(--landing-rule))] bg-[hsl(var(--landing-paper))] p-0 text-[hsl(var(--landing-ink))]">
            <SheetHeader className="border-b border-[hsl(var(--landing-rule))] px-5 py-5 text-left">
              <SheetTitle className="text-base">PlanGlade</SheetTitle>
              <SheetDescription className="text-[hsl(var(--landing-quiet))]">Calm project planning for a personal workspace.</SheetDescription>
            </SheetHeader>
            <nav aria-label="Mobile navigation" className="flex flex-col px-3 py-4">
              {landingNavLinks.map((link) => (
                <SheetClose key={link.href} asChild>
                  <a href={link.href} className="flex min-h-11 items-center rounded-md px-3 text-sm font-medium hover:bg-[hsl(var(--landing-soft))]">
                    {link.label}
                  </a>
                </SheetClose>
              ))}
            </nav>
            <div className="mt-auto grid gap-2 border-t border-[hsl(var(--landing-rule))] p-4">
              <Button asChild variant="outline" className="min-h-11 border-[hsl(var(--landing-rule))] bg-transparent">
                <a href={landingEdition.primaryHref}>{landingEdition.signInLabel}</a>
              </Button>
              <Button asChild className="min-h-11">
                <a href={landingEdition.primaryHref}>{landingEdition.primaryCtaLabel}</a>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}

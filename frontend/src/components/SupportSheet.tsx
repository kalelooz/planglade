import { BookOpen, Github, LifeBuoy, Mail, MessageSquareText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

export function SupportSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[min(360px,calc(100vw-20px))] gap-0 p-0 sm:max-w-[360px]" aria-label="Help and support">
        <SheetHeader className="border-b border-border/70 px-5 py-5 pr-14 text-left">
          <span className="mb-2 grid size-9 place-items-center rounded-lg bg-secondary text-foreground" aria-hidden="true">
            <LifeBuoy className="size-4" />
          </span>
          <SheetTitle className="text-base tracking-tight">Help &amp; support</SheetTitle>
          <SheetDescription className="text-pretty leading-5">
            Get an answer, report a problem, or tell us what would make PlanGlade better.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-1 p-3">
          <Button asChild variant="ghost" className="h-auto justify-start gap-3 whitespace-normal px-3 py-3 text-left">
            <a href="mailto:support@planglade.com?subject=PlanGlade%20support">
              <Mail className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>
                <span className="block text-[13px] font-medium">Email support</span>
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">support@planglade.com</span>
              </span>
            </a>
          </Button>
          <Button asChild variant="ghost" className="h-auto justify-start gap-3 whitespace-normal px-3 py-3 text-left">
            <a href="mailto:support@planglade.com?subject=PlanGlade%20feedback">
              <MessageSquareText className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>
                <span className="block text-[13px] font-medium">Send feedback</span>
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Share an idea or something that feels unclear.</span>
              </span>
            </a>
          </Button>
          <Button asChild variant="ghost" className="h-auto justify-start gap-3 whitespace-normal px-3 py-3 text-left">
            <a href="https://github.com/kalelooz/planglade#readme" target="_blank" rel="noreferrer">
              <BookOpen className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>
                <span className="block text-[13px] font-medium">Read the guide</span>
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Setup, usage, and self-hosting documentation.</span>
              </span>
            </a>
          </Button>
          <Button asChild variant="ghost" className="h-auto justify-start gap-3 whitespace-normal px-3 py-3 text-left">
            <a href="https://github.com/kalelooz/planglade/issues" target="_blank" rel="noreferrer">
              <Github className="size-4 text-muted-foreground" aria-hidden="true" />
              <span>
                <span className="block text-[13px] font-medium">Report a public issue</span>
                <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Use GitHub for reproducible, non-private bugs.</span>
              </span>
            </a>
          </Button>
        </div>
        <p className="mt-auto border-t border-border/70 px-5 py-4 text-xs leading-5 text-muted-foreground">
          Never include passwords, payment details, or private workspace content in a public issue.
        </p>
      </SheetContent>
    </Sheet>
  )
}

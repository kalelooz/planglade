import { Link } from 'react-router'
import { cn } from '@/lib/utils'

export function PlanGladeMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={cn('shrink-0', className)}
      viewBox="0 0 64 64"
      fill="none"
    >
      <rect width="64" height="64" rx="14" className="fill-primary" />
      <g
        className="stroke-primary-foreground"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4.5"
        transform="translate(8 8) scale(2)"
      >
        <path d="M14 9.536V7a4 4 0 0 1 4-4h1.5a.5.5 0 0 1 .5.5V5a4 4 0 0 1-4 4 4 4 0 0 0-4 4c0 2 1 3 1 5a5 5 0 0 1-1 3" />
        <path d="M4 9a5 5 0 0 1 8 4 5 5 0 0 1-8-4" />
        <path d="M5 21h14" />
      </g>
    </svg>
  )
}
export function PlanGladeBrand({ className }: { className?: string }) {
  return (
    <Link
      to="/"
      aria-label="PlanGlade home"
      className={cn('inline-flex min-h-11 w-fit items-center gap-2.5 rounded-md font-semibold tracking-[-0.02em]', className)}
    >
      <PlanGladeMark className="size-8" />
      <span>PlanGlade</span>
    </Link>
  )
}

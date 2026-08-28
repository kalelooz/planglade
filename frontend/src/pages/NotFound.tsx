import { ArrowLeft, Home } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { AuthFrame } from '@/components/AuthFrame'
import { Button } from '@/components/ui/button'

export default function NotFound({ homeHref = '/' }: { homeHref?: string }) {
  const navigate = useNavigate()
  return (
    <AuthFrame compact>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Page not found</p>
      <h1 className="pg-page-title mt-3">This path does not lead to a PlanGlade page.</h1>
      <p className="pg-body-muted mt-3">The link may be outdated, or the page may have moved into the new app.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button type="button" variant="outline" size="lg" onClick={() => navigate(-1)}><ArrowLeft aria-hidden="true" />Go back</Button>
        <Button asChild size="lg"><Link to={homeHref}><Home aria-hidden="true" />Go home</Link></Button>
      </div>
    </AuthFrame>
  )
}

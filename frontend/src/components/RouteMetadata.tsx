import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { landingEdition } from '@/components/landing/edition'

const landingTitle = 'PlanGlade — calm project planning'
const landingDescription = 'Capture loose thoughts, turn them into clear tasks, and see the same work as a list, board, timeline, calendar, or connection map.'

function setMetaContent(name: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.name = name
    document.head.append(element)
  }
  element.content = content
}

function setCanonical(href: string | null) {
  const existing = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!href) {
    existing?.remove()
    return
  }

  const element = existing ?? document.createElement('link')
  element.rel = 'canonical'
  element.href = href
  if (!existing) document.head.append(element)
}

function routeTitle(pathname: string) {
  if (pathname === '/') return landingTitle
  if (pathname === '/auth/login' || pathname === '/login') return 'Sign in · PlanGlade'
  if (pathname === '/app' || pathname.startsWith('/app/')) return 'PlanGlade workspace'
  if (pathname === '/setup') return 'Set up PlanGlade'
  if (pathname === '/onboarding') return 'Open your workspace · PlanGlade'
  if (pathname === '/invite/review') return 'Review invitation · PlanGlade'
  return 'Page not found · PlanGlade'
}

export function RouteMetadata() {
  const { pathname } = useLocation()

  useEffect(() => {
    const isMarketingRoot = pathname === '/'
    document.title = routeTitle(pathname)
    setMetaContent('robots', isMarketingRoot ? 'index, follow' : 'noindex, nofollow')
    setMetaContent(
      'description',
      isMarketingRoot ? landingDescription : 'PlanGlade personal planning workspace.',
    )
    setCanonical(isMarketingRoot && landingEdition.siteUrl ? `${landingEdition.siteUrl}/` : null)
  }, [pathname])

  return null
}

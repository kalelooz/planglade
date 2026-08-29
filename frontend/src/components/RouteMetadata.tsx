import { useEffect } from 'react'
import { useLocation } from 'react-router'
import { landingEdition } from '@/components/landing/edition'
import { normalizeRoutePath, routeTitle } from '@/lib/route-metadata'

const landingDescription = 'Capture loose thoughts, turn them into clear tasks, and see the same work as a list, board, timeline, calendar, or connection map.'
const workspaceDescription = 'PlanGlade personal planning workspace.'

function setNamedMeta(name: string, content: string | null) {
  const existing = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)
  if (content === null) {
    existing?.remove()
    return
  }
  const element = existing ?? document.createElement('meta')
  element.name = name
  element.content = content
  if (!existing) document.head.append(element)
}

function setPropertyMeta(property: string, content: string | null) {
  const existing = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`)
  if (content === null) {
    existing?.remove()
    return
  }
  const element = existing ?? document.createElement('meta')
  element.setAttribute('property', property)
  element.content = content
  if (!existing) document.head.append(element)
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

function setLandingSocialMetadata(isMarketingRoot: boolean) {
  const title = isMarketingRoot ? 'PlanGlade — Calm personal project planning' : null
  const description = isMarketingRoot
    ? 'Capture work once, then see the same tasks as a list, board, timeline, calendar, or connection map.'
    : null
  const image = isMarketingRoot ? '/planglade-social-preview.svg' : null

  setPropertyMeta('og:type', isMarketingRoot ? 'website' : null)
  setPropertyMeta('og:site_name', isMarketingRoot ? 'PlanGlade' : null)
  setPropertyMeta('og:title', title)
  setPropertyMeta('og:description', description)
  setPropertyMeta('og:image', image)
  setPropertyMeta('og:image:type', isMarketingRoot ? 'image/svg+xml' : null)
  setPropertyMeta('og:image:alt', isMarketingRoot ? 'PlanGlade mark and the words Your work, without the work of managing it.' : null)
  setNamedMeta('twitter:card', isMarketingRoot ? 'summary_large_image' : null)
  setNamedMeta('twitter:title', title)
  setNamedMeta('twitter:description', isMarketingRoot ? 'A calm personal workspace for tasks, projects, notes, schedules, and their connections.' : null)
  setNamedMeta('twitter:image', image)
}

export function RouteMetadata() {
  const { pathname } = useLocation()

  useEffect(() => {
    const isMarketingRoot = normalizeRoutePath(pathname) === '/'
    document.title = routeTitle(pathname)
    setNamedMeta('robots', isMarketingRoot ? 'index, follow' : 'noindex, nofollow')
    setNamedMeta('description', isMarketingRoot ? landingDescription : workspaceDescription)
    setCanonical(isMarketingRoot && landingEdition.siteUrl ? `${landingEdition.siteUrl}/` : null)
    setLandingSocialMetadata(isMarketingRoot)
  }, [pathname])

  return null
}

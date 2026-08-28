export type LandingLink = {
  label: string
  href: string
}

export type LandingTrustDetail = {
  kind: 'workspace' | 'sign-in' | 'persistence' | 'open-source'
  label: string
  description: string
}

type ProductFilm = {
  src: string
  captions: string
  poster: string
}

type LandingEdition = {
  primaryCtaLabel: string
  primaryHref: string
  signInLabel: string
  microcopy: string
  siteUrl: string | null
  productFilm: ProductFilm | null
  trustIntro: string
  trustDetails: readonly LandingTrustDetail[]
  legalLinks: readonly LandingLink[]
}

export const landingEdition: LandingEdition = {
  primaryCtaLabel: 'Open PlanGlade',
  primaryHref: '/auth/login?next=/app',
  signInLabel: 'Sign in',
  microcopy: 'A personal workspace. Start with the work already in front of you.',
  siteUrl: null,
  productFilm: null,
  trustIntro: 'PlanGlade currently supports personal workspaces. Team workspaces and invitations are planned, but they are not available.',
  trustDetails: [
    {
      kind: 'workspace',
      label: 'Workspace',
      description: 'A personal workspace that starts with the work already in front of you.',
    },
    {
      kind: 'open-source',
      label: 'Open source',
      description: 'The complete self-hosted core is available in the public PlanGlade repository.',
    },
  ],
  legalLinks: [],
}

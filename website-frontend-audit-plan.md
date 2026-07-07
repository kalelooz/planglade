# Website Frontend Audit Plan

## Goal

Turn the useful parts of the four website/frontend audits into one scoped fix pass, without redesigning the product or adding speculative pages.

## Tasks

- [x] Browser-smoke the live and local website at desktop and 375px mobile widths. Verified local demo hydration, no horizontal scroll, support routes, `/app` redirect, and read-only behavior. The live site is healthy but still serves the pre-audit build.
- [x] Fix metadata for the public pages. Homepage now has `og:image`, `twitter:image`, `summary_large_image`, and a canonical URL; `/demo` has demo-specific metadata and is deliberately `noindex, nofollow` and omitted from the sitemap because it contains fixture content.
- [x] Tighten solo-first copy. Removed "small teams" from landing/README copy and added a concise audience line near the hero.
- [x] Reconcile public-facing repository wording locally. README now says "Self-host now. Cloud soon" and documents the Docker baseline. Publishing the branch and updating the GitHub repository description remain external maintainer actions.
- [x] Improve demo read-only affordances. Mutating shell controls expose accessible disabled state, read visually as unavailable, and the exact demo warning is visible on desktop and mobile.
- [x] Add demo/app-shell accessibility polish. Added a skip link and 44px mobile shell/sidebar targets while preserving focus styles.
- [x] Polish the product preview without broad redesign. Replaced personal/launch-specific details with generic sample data. Browser review confirmed the existing mobile preview remains readable without horizontal overflow, so no structural redesign was added.
- [x] Clarify self-host and trust links. The existing README/docs anchor remains sufficient; homepage/footer copy now sets technical expectations and links GitHub, License, Security, and self-host docs.
- [x] Add/update small regression checks for metadata, copy, demo read-only affordances, accessibility, and README wording.
- [x] Run final local validation. A deployed-preview check remains dependent on publishing these uncommitted changes.

## Done When

- [x] Every accepted audit note in `docs/audits/website-frontend-2026-07-06/README.md` is fixed, explicitly deferred, or has a short reason recorded.
- [x] The live/public site and public GitHub no longer contradict the project docs on demo, cloud, Docker, or audience. PR #27 was merged and production was verified on 2026-07-07.
- [x] The demo is visibly and server-side read-only locally.
- [x] The website still follows the product direction: calm, solo-first, capture first, organize second, no fake claims.

## Notes

- Keep this as `WEBSITE-POST-LIVE-AUDIT-001` work. No billing, checkout, cloud account, broad redesign, dependency addition, or app feature expansion.
- Prefer edits to existing landing/demo files over new routes. Create a dedicated self-host route only after the existing section and README/docs path are proven insufficient.

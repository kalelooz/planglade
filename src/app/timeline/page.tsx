import { redirect } from "next/navigation"

// SCOPE-FREEZE-001: Timeline is a Phase 2 planning surface and must stay
// hidden from the public MVP. The route is preserved as a redirect so legacy
// links land on the app home instead of a full timeline product surface.
// The timeline view-model helpers under src/app/timeline/timeline-view-model.ts
// and src/lib/timeline.ts are intentionally kept because tests import them.
export default function LegacyTimelinePage() {
  redirect("/app")
}

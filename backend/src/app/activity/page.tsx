import { redirect } from "next/navigation"

// SCOPE-FREEZE-001: Activity feed/report surfaces are deferred for the
// solo-first MVP. The route is preserved as a redirect so legacy links land
// on the app home instead of a full activity-log product surface.
export default function LegacyActivityPage() {
  redirect("/app")
}

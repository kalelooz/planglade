import { redirect } from "next/navigation"

// SCOPE-FREEZE-001: Team/admin surfaces are deferred for the solo-first MVP.
// The route is preserved as a redirect so legacy links land on the app home
// instead of a full team-management product surface.
export default function LegacyTeamPage() {
  redirect("/app")
}

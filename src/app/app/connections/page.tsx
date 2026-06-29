import { redirect } from "next/navigation"

// SCOPE-FREEZE-001: Connections/Work Map is a deferred product surface for the
// solo-first MVP. The route is preserved as a redirect so legacy links land on
// the app home instead of a full relationship-graph product surface.
export default function ConnectionsPage() {
  redirect("/app")
}

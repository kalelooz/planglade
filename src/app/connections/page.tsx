import { redirect } from "next/navigation"

// SCOPE-FREEZE-001: Connections/Work Map is a deferred product surface for the
// solo-first MVP. Legacy and canonical links both redirect to the app home.
export default function LegacyConnectionsPage() {
  redirect("/app")
}

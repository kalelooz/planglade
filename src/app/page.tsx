import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth-options"
import { selfHostRootDestination } from "@/lib/self-host-root-route"
import { resolveSetupEligibility } from "@/lib/self-host-setup/service"

export default async function RootPage() {
  let eligibility
  try {
    eligibility = await resolveSetupEligibility()
  } catch {
    redirect("/setup")
  }
  const session = eligibility === "complete" ? await getServerSession(authOptions) : null

  redirect(selfHostRootDestination(eligibility, Boolean(session?.user?.id)))
}

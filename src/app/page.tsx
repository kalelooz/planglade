import { redirect } from "next/navigation"
import { getServerSession } from "next-auth"

import { authOptions } from "@/lib/auth-options"
import { readPlanGladeEnv } from "@/lib/env-config"
import { hasSelfHostRoot, selfHostRootDestination } from "@/lib/self-host-root-route"
import { resolveSetupEligibility } from "@/lib/self-host-setup/service"
import LandingPage, { metadata } from "./landing/page"

export { metadata }

export default async function RootPage() {
  if (!hasSelfHostRoot(readPlanGladeEnv("LOCAL_AUTH_ENABLED"), process.env.PLANGLADE_SETUP_TOKEN)) {
    return <LandingPage />
  }

  let eligibility
  try {
    eligibility = await resolveSetupEligibility()
  } catch {
    redirect("/setup")
  }
  const session = eligibility === "complete" ? await getServerSession(authOptions) : null

  redirect(selfHostRootDestination(eligibility, Boolean(session?.user?.id)))
}

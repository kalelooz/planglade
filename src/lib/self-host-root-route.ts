import type { Eligibility } from "@/lib/self-host-setup/service"

export function selfHostRootDestination(eligibility: Eligibility, authenticated: boolean) {
  if (eligibility !== "complete") return "/setup"
  return authenticated ? "/app" : "/login"
}

import { redirect } from "next/navigation"

import {
  buildLegacyProjectsDestination,
  type LegacySearchParams,
} from "@/lib/legacy-route-redirects"

export default async function LegacyProjectsPage({
  searchParams,
}: {
  searchParams: Promise<LegacySearchParams>
}) {
  redirect(buildLegacyProjectsDestination(await searchParams))
}

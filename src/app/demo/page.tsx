import type { Metadata } from "next"

import { DemoClient } from "./demo-client"

export const metadata: Metadata = {
  title: "PlanGlade Demo",
  description: "Try a read-only PlanGlade demo. Demo mode changes are disabled.",
}

export default function DemoPage() {
  return <DemoClient />
}

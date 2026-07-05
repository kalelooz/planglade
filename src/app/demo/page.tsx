import type { Metadata } from "next"

import { DemoClient } from "./demo-client"

export const metadata: Metadata = {
  title: "PlanGlade Demo",
  description: "Try the real PlanGlade interface in read-only demo mode.",
}

export default function DemoPage() {
  return <DemoClient slug={[]} />
}

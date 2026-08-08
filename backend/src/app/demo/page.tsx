import type { Metadata } from "next"

import { DemoClient } from "./demo-client"

export const metadata: Metadata = {
  title: "PlanGlade read-only demo",
  description: "Browse PlanGlade with sample projects. Demo mode - changes are disabled.",
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "PlanGlade read-only demo",
    description: "Browse PlanGlade with sample projects. Demo mode - changes are disabled.",
    type: "website",
    images: [
      {
        url: "/brand/og-image.png",
        width: 1280,
        height: 640,
        alt: "PlanGlade read-only demo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PlanGlade read-only demo",
    description: "Browse PlanGlade with sample projects. Demo mode - changes are disabled.",
    images: ["/brand/og-image.png"],
  },
}

export default function DemoPage() {
  return <DemoClient slug={[]} />
}

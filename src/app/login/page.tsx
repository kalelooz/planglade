"use client"

import { Suspense } from "react"

import { LoginPage } from "@/components/flowboard/login-page"

function LoginPageFallback() {
  return <div className="p-6 text-sm text-muted-foreground">Loading sign-in...</div>
}

export default function FlowBoardLoginRoute() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPage />
    </Suspense>
  )
}

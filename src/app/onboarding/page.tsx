"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type SessionPayload = {
  workspace?: { name?: string };
  user?: { name?: string | null; email?: string };
};

export default function OnboardingPage() {
  const [session, setSession] = useState<SessionPayload | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload) => {
        if (active) setSession(payload);
      })
      .catch(() => {
        if (active) setSession(null);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-md rounded-md border bg-card p-6">
        <div className="mb-5 flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-foreground text-[11px] font-bold tracking-tight text-background">
            PG
          </span>
          <span>PlanGlade</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Workspace ready</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {session?.workspace?.name
            ? `${session.workspace.name} is ready for your projects.`
            : "Your workspace is prepared automatically when you continue."}
        </p>
        <div className="mt-6 flex gap-2">
          <Link className="lov-btn lov-btn-primary h-9 px-4" href="/app">
            Continue to Home
          </Link>
          <Link className="lov-btn h-9 px-4" href="/login">
            Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}

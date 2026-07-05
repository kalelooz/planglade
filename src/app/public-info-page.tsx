import Link from "next/link";
import type { ReactNode } from "react";

import { PlanGladeMark } from "@/components/brand/plan-glade-mark";

export function PublicInfoPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 text-zinc-900 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[15px] font-semibold"
        >
          <PlanGladeMark />
          PlanGlade
        </Link>
        <section className="mt-12 rounded-lg border border-zinc-200 bg-white p-6 sm:p-8">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">
            Self-host now. Cloud soon. Try demo.
          </p>
          <h1 className="mt-3 text-[32px] font-semibold tracking-tight">
            {title}
          </h1>
          <p className="mt-3 text-[15px] leading-7 text-zinc-600">{intro}</p>
          <div className="mt-8 space-y-6 text-[14px] leading-7 text-zinc-600">
            {children}
          </div>
          <div className="mt-8 flex flex-col gap-3 border-t border-zinc-200 pt-6 sm:flex-row">
            <Link
              href="/demo"
              className="inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-[13px] font-semibold text-white hover:bg-zinc-700"
            >
              Try demo
            </Link>
            <Link
              href="https://github.com/kalelooz/planglade"
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-[13px] font-semibold text-zinc-800 hover:bg-zinc-50"
              target="_blank"
              rel="noreferrer"
            >
              View on GitHub
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

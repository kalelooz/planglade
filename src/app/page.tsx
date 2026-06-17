import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-5">
        <header className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded bg-foreground text-[11px] font-bold tracking-tight text-background">
              PG
            </span>
            <span>PlanGlade</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link className="lov-btn lov-btn-ghost" href="/login">
              Log in
            </Link>
            <Link className="lov-btn lov-btn-primary" href="/app">
              Open app
            </Link>
          </nav>
        </header>

        <section className="grid flex-1 items-center gap-10 py-14 md:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="mb-3 text-sm font-medium text-muted-foreground">planglade.com</p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
              PlanGlade
            </h1>
            <p className="mt-4 max-w-xl text-xl text-muted-foreground">
              A calm clearing for your projects.
            </p>
            <p className="mt-6 max-w-xl text-sm leading-6 text-muted-foreground">
              Capture work, organize tasks, keep notes nearby, and see dated work on a calendar.
              PlanGlade is focused on the core project loop first, without fake analytics or extra
              enterprise clutter.
            </p>
            <div className="mt-8 flex flex-wrap gap-2">
              <Link className="lov-btn lov-btn-primary h-9 px-4" href="/login">
                Get started
              </Link>
              <Link className="lov-btn h-9 px-4" href="/app">
                Continue to workspace
              </Link>
            </div>
          </div>

          <div className="rounded-md border bg-card p-4">
            <div className="border-b pb-3 text-sm font-medium">MVP workspace</div>
            <ul className="grid gap-2 pt-3 text-sm text-muted-foreground">
              <li>Home for today's work and quick capture</li>
              <li>Inbox for unprocessed captures</li>
              <li>Tasks, Projects, Notes, Calendar, and Settings</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}

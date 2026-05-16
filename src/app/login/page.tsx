import Link from "next/link";
import { ArrowRight } from "lucide-react";

export const metadata = { title: "Sign in — FlowBoard" };

export default function LoginPage() {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-background text-foreground lg:grid-cols-[1fr_440px]">
      <div className="hidden border-r bg-sidebar lg:flex lg:flex-col lg:justify-between lg:p-10">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-foreground text-[11px] font-bold text-background">FB</span>
          FlowBoard
        </Link>
        <div className="max-w-md">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">A quieter project tool</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Capture work fast.<br /><span className="text-muted-foreground">Organize later.</span></h1>
          <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
            FlowBoard keeps tasks, notes, and projects in one calm surface — built for solo operators and small teams who want fewer surfaces, not more.
          </p>
        </div>
        <p className="text-[11px] text-muted-foreground">© 2026 Acme Inc.</p>
      </div>

      <div className="flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-10 flex items-center gap-2 text-sm font-semibold lg:hidden">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-foreground text-[11px] font-bold text-background">FB</span>
            FlowBoard
          </Link>
          <h2 className="text-[19px] font-semibold tracking-tight">Sign in to FlowBoard</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Use your work Google account.</p>

          <button className="mt-8 flex h-10 w-full items-center justify-center gap-2.5 rounded-md border bg-card text-[13px] font-medium hover:bg-[var(--color-hover)]">
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18A10.99 10.99 0 0 0 1 12c0 1.77.42 3.44 1.18 4.94l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>
            Continue with Google
          </button>

          <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
          </div>

          <label className="text-[12px] text-muted-foreground">Email</label>
          <input className="mt-1 h-9 w-full rounded-md border bg-card px-2.5 text-[13px] outline-none focus:border-ring" placeholder="you@company.com" />
          <Link href="/" className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-primary text-[13px] font-medium text-primary-foreground hover:opacity-90">
            Continue <ArrowRight className="h-3.5 w-3.5" />
          </Link>

          <p className="mt-8 text-[11px] text-muted-foreground">
            By continuing you agree to the terms and privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}

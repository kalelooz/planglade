import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  Calendar as CalendarDays,
  Kanban as FolderKanban,
  GithubLogo as Github,
  Tray as Inbox,
  ListChecks as ListTodo,
  List as Menu,
} from "@phosphor-icons/react/ssr";
import { PlanGladeMark } from "@/components/brand/plan-glade-mark";
import { ProductShowcase as LandingProductShowcase } from "./product-showcase";

export const metadata: Metadata = {
  title: "PlanGlade - A calm clearing for your projects",
  description:
    "Open-source workspace for tasks, projects, notes, calendar planning, and getting work out of your head. Self-host now. Cloud soon.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "PlanGlade - A calm clearing for your projects",
    description:
      "Open-source workspace for tasks, projects, notes, calendar planning, and getting work out of your head. Self-host now. Cloud soon.",
    url: "/",
    type: "website",
    images: [
      {
        url: "/brand/og-image.png",
        width: 1280,
        height: 640,
        alt: "PlanGlade product preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PlanGlade - A calm clearing for your projects",
    description:
      "Open-source workspace for tasks, projects, notes, calendar planning, and getting work out of your head. Self-host now. Cloud soon.",
    images: ["/brand/og-image.png"],
  },
};

const githubUrl = "https://github.com/kalelooz/planglade";
const selfHostUrl = `${githubUrl}#self-hosting-status`;
const demoUrl = "/demo";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Status", href: "#status" },
  { label: "Self-host", href: "#self-host" },
  { label: "FAQ", href: "#faq" },
];

const trustBadges = [
  { label: "Self-host now" },
  { label: "Cloud soon" },
  { label: "Try demo" },
];

const features = [
  {
    title: "Tasks",
    body: "Capture work, set priority, add dates, and keep one task across every view.",
    icon: ListTodo,
  },
  {
    title: "Projects",
    body: "Group related work with project context, progress, and the next thing to do.",
    icon: FolderKanban,
  },
  {
    title: "Notes",
    body: "Keep lightweight notes and project context close to the work they explain.",
    icon: BookOpen,
  },
  {
    title: "Inbox",
    body: "Drop ideas quickly, then turn them into tasks when you are ready.",
    icon: Inbox,
  },
  {
    title: "Calendar",
    body: "See dated tasks on a calendar without creating a second event system.",
    icon: CalendarDays,
  },
];

const statusItems = [
  { label: "Available now", value: "Self-host" },
  { label: "Available now", value: "Demo mode" },
  { label: "Coming soon", value: "Cloud" },
];

const pricingItems = [
  { label: "Self-hosted", value: "Free" },
  { label: "Cloud", value: "Paid plan coming soon" },
];

const faqs = [
  {
    question: "Is PlanGlade free?",
    answer:
      "Yes. You can self-host PlanGlade for free.",
  },
  {
    question: "Is Cloud live?",
    answer: "Not yet. Cloud is coming soon.",
  },
  {
    question: "Can I try a demo?",
    answer: "Yes. Try demo.",
  },
  {
    question: "Who is it for?",
    answer:
      "Solo builders, freelancers, students, writers, maintainers, and anyone who wants a calmer project workspace.",
  },
];

function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-5 items-center gap-1.5 rounded-full border border-zinc-200 bg-white px-2.5 text-[11px] font-medium text-zinc-600">
      {children}
    </span>
  );
}

function PrimaryButton({
  href,
  children,
  className = "",
  target,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  target?: string;
}) {
  return (
    <Link
      href={href}
      target={target}
      rel={target === "_blank" ? "noreferrer" : undefined}
      className={`inline-flex h-10 items-center justify-center rounded-md bg-zinc-900 px-4 text-[13px] font-semibold text-white transition hover:bg-zinc-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${className}`}
    >
      {children}
    </Link>
  );
}

function SecondaryButton({
  href,
  children,
  className = "",
  target,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  target?: string;
}) {
  return (
    <Link
      href={href}
      target={target}
      rel={target === "_blank" ? "noreferrer" : undefined}
      className={`inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-[13px] font-semibold text-zinc-800 transition hover:bg-zinc-50 hover:border-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${className}`}
    >
      {children}
    </Link>
  );
}

function Logo() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2 text-zinc-900"
      aria-label="PlanGlade home"
    >
      <PlanGladeMark />
      <span className="text-[16px] font-semibold tracking-tight">PlanGlade</span>
    </Link>
  );
}

function NavAnchor({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-md px-2.5 py-1.5 text-[13px] font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
    >
      {children}
    </Link>
  );
}

/**
 * Fully neutral geometric backdrop shared by the hero and product showcase.
 * Layers: faint dot grid, a subtle diagonal mesh, and a soft spotlight.
 */
function GeometricBackdrop() {
  return (
    <div
      aria-hidden="true"
      data-hero-geometric-backdrop="true"
      className="pointer-events-none absolute inset-0 -z-0 overflow-hidden"
    >
      {/* Large faint zinc dot grid */}
      <div
        className="absolute inset-0 opacity-[0.6]"
        style={{
          backgroundColor: "rgb(250 250 250)",
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgb(228 228 231 / 0.75) 1px, transparent 0)",
          backgroundSize: "26px 26px",
        }}
      />
      {/* Diagonal neutral line mesh, top-right */}
      <svg
        className="absolute right-[-10%] top-[-10%] h-[520px] w-[520px] opacity-[0.5]"
        viewBox="0 0 520 520"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
      >
        {Array.from({ length: 9 }).map((_, i) => (
          <line
            key={`d1-${i}`}
            x1={-40 + i * 70}
            y1={560}
            x2={560}
            y2={-40 + i * 70}
            stroke="rgb(212 212 216)"
            strokeOpacity={0.4}
            strokeWidth={1}
          />
        ))}
        {Array.from({ length: 9 }).map((_, i) => (
          <line
            key={`d2-${i}`}
            x1={-40 + i * 70}
            y1={-40}
            x2={560}
            y2={560 - i * 70}
            stroke="rgb(228 228 231)"
            strokeOpacity={0.5}
            strokeWidth={1}
          />
        ))}
      </svg>
      {/* Soft neutral spotlight toward upper-center */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 60% at 50% 24%, rgb(244 244 245 / 0.95) 0%, rgb(250 250 250 / 0) 72%)",
        }}
      />
    </div>
  );
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-2 text-[24px] font-semibold tracking-tight text-zinc-950">
        {value}
      </p>
    </div>
  );
}

function FaqItem({
  question,
  answer,
  defaultOpen = false,
}: {
  question: string;
  answer: string;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-zinc-200 bg-white px-5 transition-colors open:border-zinc-300"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[14px] font-semibold text-zinc-900 [&::-webkit-details-marker]:hidden">
        <span>{question}</span>
        <span
          aria-hidden="true"
          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="pb-4 pr-2 text-[13px] leading-6 text-zinc-600">
        {answer}
      </div>
    </details>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-zinc-50 text-zinc-900 antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-zinc-900 focus:shadow"
      >
        Skip to main content
      </a>

      <main id="main">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-zinc-200 bg-zinc-50/85 backdrop-blur-sm">
          <div className="mx-auto grid h-14 max-w-[1200px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 sm:px-6 lg:px-8">
            <Logo />
            <nav
              aria-label="Main navigation"
              className="hidden items-center justify-center gap-1 md:flex"
            >
              {navLinks.map((link) => (
                <NavAnchor key={link.label} href={link.href}>
                  {link.label}
                </NavAnchor>
              ))}
            </nav>
            <div className="flex items-center justify-end gap-2">
              <PrimaryButton href={demoUrl} className="hidden sm:inline-flex">
                Try demo
              </PrimaryButton>
              <details className="group relative md:hidden" aria-label="Navigation menu">
                <summary
                  aria-label="Open navigation menu"
                  className="inline-flex h-9 w-9 list-none cursor-pointer items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-700 transition hover:bg-zinc-50 [&::-webkit-details-marker]:hidden"
                >
                  <Menu className="h-4 w-4" aria-hidden="true" />
                </summary>
                <nav
                  aria-label="Mobile navigation"
                  className="absolute right-0 top-11 z-50 grid min-w-56 gap-1 rounded-md border border-zinc-200 bg-white p-2 shadow-md"
                >
                  {navLinks.map((link) => (
                    <Link
                      key={link.label}
                      href={link.href}
                      className="rounded-md px-3 py-2 text-[13px] font-medium text-zinc-700 hover:bg-zinc-100"
                    >
                      {link.label}
                    </Link>
                  ))}
                  <PrimaryButton href={demoUrl} className="mt-1">
                    Try demo
                  </PrimaryButton>
                </nav>
              </details>
            </div>
          </div>
        </header>

        {/* Hero - copy only; the product preview lives in its own full-width
            showcase section directly below. */}
        <section className="relative isolate overflow-hidden border-b border-zinc-200 bg-zinc-50">
          <GeometricBackdrop />
          <div className="relative z-10 mx-auto max-w-[1180px] px-4 pb-16 pt-16 sm:px-6 lg:px-8 lg:pb-20 lg:pt-24">
            <div className="mx-auto max-w-[760px] text-center">
              <ul className="mb-6 flex flex-wrap justify-center gap-2">
                {trustBadges.map((badge) => (
                  <li key={badge.label}>
                    <Badge>{badge.label}</Badge>
                  </li>
                ))}
              </ul>
              <h1 className="text-balance text-[42px] font-semibold leading-[1.05] tracking-tight text-zinc-900 sm:text-[56px] lg:text-[64px]">
                A calm clearing for your projects.
              </h1>
              <p className="mx-auto mt-6 max-w-[600px] text-pretty text-[17px] leading-7 text-zinc-600 sm:text-[19px]">
                Open-source workspace for tasks, projects, notes, calendar
                planning, and getting work out of your head.
              </p>
              <p className="mx-auto mt-3 max-w-[540px] text-[13px] leading-6 text-zinc-500">
                For solo builders, freelancers, students, writers, and maintainers.
              </p>
              <p className="mt-4 text-[13px] font-semibold text-zinc-700">
                Self-host now. Cloud soon.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <SecondaryButton href={githubUrl} target="_blank">
                  <Github className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  View on GitHub
                </SecondaryButton>
                <PrimaryButton href={selfHostUrl} target="_blank">
                  Self-host PlanGlade
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                </PrimaryButton>
                <SecondaryButton href={demoUrl}>Try demo</SecondaryButton>
              </div>
              <p className="mt-5 text-[12px] text-zinc-400">
                Demo mode. Changes are disabled.
              </p>
            </div>
          </div>
        </section>

        {/* Full-width product showcase (separate from the hero copy) */}
        <LandingProductShowcase />

        {/* Features */}
        <section id="features" className="scroll-mt-16 border-b border-zinc-200 bg-white">
          <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="max-w-2xl">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">
                Features
              </p>
              <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-zinc-900 sm:text-[32px]">
                The core loop, without the clutter.
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-zinc-600">
                Capture first, organize second. One task across list, board, and
                calendar. Notes and context kept close. Nothing pretending to be
                more than it is.
              </p>
            </div>
            <ul className="mt-10 grid gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <li key={feature.title} className="bg-white p-6">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-zinc-700">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <h3 className="mt-3 text-[15px] font-semibold text-zinc-900">
                      {feature.title}
                    </h3>
                    <p className="mt-1.5 text-[13px] leading-6 text-zinc-600">
                      {feature.body}
                    </p>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

        {/* Status */}
        <section
          id="status"
          className="relative isolate scroll-mt-14 overflow-hidden border-b border-zinc-200 bg-zinc-100"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.95),rgba(244,244,245,0)_70%)]"
          />
          <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="animate-in fade-in-0 text-center duration-700 motion-reduce:animate-none">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">
                Status
              </p>
              <h2 className="mt-2 text-[30px] font-semibold tracking-tight text-zinc-950 sm:text-[38px]">
                Self-host now. Cloud soon. Try demo.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-pretty text-[15px] leading-7 text-zinc-600 sm:text-[16px]">
                Run PlanGlade yourself today. Demo mode is read-only.
              </p>
            </div>

            <div className="mt-9 grid gap-4 md:grid-cols-3">
              {statusItems.map((item) => (
                <InfoCard key={`${item.label}-${item.value}`} {...item} />
              ))}
            </div>
          </div>
        </section>

        {/* Simple pricing */}
        <section className="scroll-mt-16 border-b border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="max-w-2xl">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">
                Simple start
              </p>
              <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-zinc-900 sm:text-[32px]">
                Free to self-host. Paid cloud coming.
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-zinc-600">
                No checkout. No paid signup. No cloud account today.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-2">
              {pricingItems.map((item) => (
                <InfoCard key={`${item.label}-${item.value}`} {...item} />
              ))}
            </div>
          </div>
        </section>

        {/* Open source + Self-host */}
        <section
          id="open-source"
          className="scroll-mt-16 border-b border-zinc-200 bg-white"
        >
          <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="grid gap-10 md:grid-cols-2 md:gap-12">
              <div id="self-host" className="scroll-mt-16">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">
                  Self-host
                </p>
                <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-zinc-900">
                  Run it on your own machine.
                </h2>
                <p className="mt-3 text-[14px] leading-6 text-zinc-600">
                  Self-hosting is a technical setup using Node.js 20+ with
                  SQLite. The current path is an early self-host baseline with
                  Docker and local setup notes in the public repo.
                </p>
                <pre className="mt-5 overflow-x-auto rounded-md border border-zinc-200 bg-zinc-900 p-4 text-[12px] leading-6 text-zinc-100">
{`$ git clone https://github.com/kalelooz/planglade
$ cd planglade
# See README for Docker and local setup`}
                </pre>
                <p className="mt-3 text-[12px] leading-5 text-zinc-500">
                  Free to self-host. The in-app Settings export gives you a
                  portable JSON copy of your workspace.
                </p>
                <div className="mt-5">
                  <PrimaryButton href={selfHostUrl} target="_blank">
                    Self-host PlanGlade
                  </PrimaryButton>
                </div>
              </div>

              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">
                  Open source
                </p>
                <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-zinc-900">
                  Built in the open. Licensed under AGPL-3.0.
                </h2>
                <p className="mt-3 text-[14px] leading-6 text-zinc-600">
                  PlanGlade is open source under AGPL-3.0. No checkout, no
                  fake demo, no fake stats.
                </p>
                <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">
                    Public repo
                  </p>
                  <p className="mt-2 text-[13px] leading-5 text-zinc-600">
                    View the source, self-host PlanGlade, or check demo and
                    cloud status.
                  </p>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <SecondaryButton href={githubUrl} target="_blank">
                      <Github className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      View on GitHub
                    </SecondaryButton>
                    <PrimaryButton href={demoUrl}>Try demo</PrimaryButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-16 border-b border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-[760px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="text-center">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">
                FAQ
              </p>
              <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-zinc-900 sm:text-[32px]">
                Frequently asked questions
              </h2>
            </div>
            <div className="mt-8 space-y-3">
              {faqs.map((faq, index) => (
                <FaqItem
                  key={faq.question}
                  question={faq.question}
                  answer={faq.answer}
                  defaultOpen={index === 0}
                />
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="bg-white">
          <div className="mx-auto flex max-w-[760px] flex-col items-center px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-20">
            <h2 className="text-[28px] font-semibold tracking-tight text-zinc-900 sm:text-[32px]">
              Start planning with clarity.
            </h2>
            <p className="mt-3 max-w-[520px] text-[15px] leading-7 text-zinc-600">
              Self-host now. Cloud soon. Try demo.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <SecondaryButton href={githubUrl} target="_blank">
                <Github className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                View on GitHub
              </SecondaryButton>
              <PrimaryButton href={demoUrl}>Try demo</PrimaryButton>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-zinc-200 bg-zinc-50">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-4 px-4 py-8 text-[13px] text-zinc-500 sm:px-6 md:flex-row lg:px-8">
          <Logo />
          <nav aria-label="Footer navigation">
            <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              <li><Link href="#features" className="hover:text-zinc-900">Features</Link></li>
              <li><Link href="#status" className="hover:text-zinc-900">Status</Link></li>
              <li><Link href={githubUrl} target="_blank" rel="noreferrer" className="hover:text-zinc-900">GitHub</Link></li>
              <li><Link href={selfHostUrl} target="_blank" rel="noreferrer" className="hover:text-zinc-900">Self-host docs</Link></li>
              <li><Link href="/terms" className="hover:text-zinc-900">License</Link></li>
              <li><Link href="#faq" className="hover:text-zinc-900">FAQ</Link></li>
              <li><Link href="/privacy" className="hover:text-zinc-900">Privacy</Link></li>
              <li><Link href="/security" className="hover:text-zinc-900">Security</Link></li>
              <li><Link href="/contact" className="hover:text-zinc-900">Contact</Link></li>
            </ul>
          </nav>
          <p>&copy; 2026 PlanGlade</p>
        </div>
      </footer>
    </div>
  );
}

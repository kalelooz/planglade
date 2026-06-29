import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  Download,
  FolderKanban,
  Github,
  Inbox,
  ListTodo,
  Menu,
  Minus,
} from "lucide-react";
import { PlanGladeMark } from "@/components/brand/plan-glade-mark";
import { ProductShowcase as LandingProductShowcase } from "./product-showcase";

export const metadata: Metadata = {
  title: "PlanGlade — A calm workspace for your projects",
  description:
    "Open-source project workspace for quick capture, inbox triage, tasks, projects, notes, and calendar. Free to self-host under AGPL-3.0.",
  openGraph: {
    title: "PlanGlade — A calm workspace for your projects",
    description:
      "Open-source project workspace for quick capture, inbox triage, tasks, projects, notes, and calendar. Free to self-host under AGPL-3.0.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "PlanGlade — A calm workspace for your projects",
    description:
      "Open-source project workspace for quick capture, inbox triage, tasks, projects, notes, and calendar. Free to self-host under AGPL-3.0.",
  },
};

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Open source", href: "#open-source" },
  { label: "Self-host", href: "#self-host" },
  { label: "Roadmap", href: "#roadmap" },
  { label: "FAQ", href: "#faq" },
];

const trustBadges = [
  { label: "Open source" },
  { label: "Self-hostable" },
  { label: "Solo-first" },
];

const features = [
  {
    title: "Capture without friction",
    body: "Quick capture sends ideas and tasks straight to your Inbox. No project, no fields, no decisions required up front.",
    icon: Inbox,
  },
  {
    title: "Turn inbox items into tasks",
    body: "Triage captured items into real tasks with project, due date, and priority in a few compact rows.",
    icon: ListTodo,
  },
  {
    title: "Organize projects",
    body: "Group related tasks into projects with a focused Project Home, open work, and linked notes.",
    icon: FolderKanban,
  },
  {
    title: "Keep notes and context nearby",
    body: "Project notes and context live alongside your work - always one click away, never a separate app.",
    icon: BookOpen,
  },
  {
    title: "See dated tasks on calendar",
    body: "Calendar is a view over your tasks, not a duplicate event system. Due dates show up where you expect them.",
    icon: CalendarDays,
  },
  {
    title: "Export and own your data",
    body: "Export your full workspace as JSON from Settings. Your projects, notes, and context stay portable.",
    icon: Download,
  },
];

const startFeatures = [
  "Inbox capture and triage",
  "Tasks list and board toggle",
  "Projects and Project Home",
  "Notes and project context",
  "Calendar over task due dates",
  "Export your workspace data",
  "No billing",
  "No upgrade wall",
  "No fake limits",
] as const;

const roadmapAvailable = [
  "Inbox triage",
  "Tasks (list and board)",
  "Projects and Project Home",
  "Project notes and context",
  "Calendar over due dates",
  "Workspace JSON export",
];

const roadmapNext = [
  "Timeline planning view",
  "Task dependencies",
  "Recurring tasks",
  "Mobile polish",
];

const roadmapLater = [
  "Sharing and collaboration",
  "Time tracking",
  "Hosted cloud option",
];

const faqs = [
  {
    question: "Is PlanGlade really open source?",
    answer:
      "Yes. PlanGlade is released under AGPL-3.0. The public repository will be linked from the Open source section when the release is ready.",
  },
  {
    question: "Can I self-host PlanGlade?",
    answer:
      "Yes. Self-hosting is part of the product. The current setup runs on Node.js 20+ with SQLite, and the in-app export gives you a portable JSON copy of your workspace. Self-hosting docs are still being finalized before public release.",
  },
  {
    question: "Is PlanGlade free?",
    answer:
      "The open-source app is free to run yourself. There are no paid plans, no seat charges, and no paid features. The whole product today is the self-hosted build.",
  },
  {
    question: "Why AGPL-3.0?",
    answer:
      "AGPL-3.0 keeps PlanGlade open even if a hosted service ever appears. Anyone running a modified copy as a service has to publish their changes too.",
  },
  {
    question: "Is hosted cloud available?",
    answer:
      "Not today. The only way to use PlanGlade right now is to run it yourself. A hosted option is a possible later step, not a current product.",
  },
  {
    question: "What does PlanGlade include today?",
    answer:
      "Quick capture, Inbox triage, Tasks with list and board views, Projects with a focused Project Home, project notes and context, and a Calendar over due dates - all backed by durable server-side storage.",
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
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
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
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex h-10 items-center justify-center rounded-md border border-zinc-200 bg-white px-4 text-[13px] font-semibold text-zinc-800 transition hover:bg-zinc-50 hover:border-zinc-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${className}`}
    >
      {children}
    </Link>
  );
}

function Logo() {
  return (
    <Link
      href="/landing"
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

function RoadmapColumn({
  title,
  items,
  marker,
}: {
  title: string;
  items: string[];
  marker: "check" | "arrow" | "minus";
}) {
  const Icon = marker === "check" ? Check : marker === "arrow" ? ArrowRight : Minus;
  const iconClass =
    marker === "check"
      ? "text-zinc-900"
      : marker === "arrow"
        ? "text-zinc-500"
        : "text-zinc-400";
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </p>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-[13px] text-zinc-700">
            <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${iconClass}`} aria-hidden="true" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
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
              <PrimaryButton href="#start" className="hidden sm:inline-flex">
                Get started
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
                  <PrimaryButton href="#start" className="mt-1">
                    Get started
                  </PrimaryButton>
                </nav>
              </details>
            </div>
          </div>
        </header>

        {/* Hero — copy only; the product demo lives in its own full-width
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
                A calm workspace for your projects.
              </h1>
              <p className="mx-auto mt-6 max-w-[600px] text-pretty text-[17px] leading-7 text-zinc-600 sm:text-[19px]">
                PlanGlade brings quick capture, an inbox, tasks, projects, notes,
                and a calendar into one focused workspace - without the bloat of
                enterprise PM tools.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <PrimaryButton href="#start">
                  Get started
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
                </PrimaryButton>
                <SecondaryButton href="#open-source">
                  <Github className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                  View on GitHub
                </SecondaryButton>
              </div>
              <p className="mt-5 text-[12px] text-zinc-400">
                Free to self-host under AGPL-3.0.
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

        {/* Free start */}
        <section
          id="start"
          className="relative isolate scroll-mt-14 overflow-hidden border-b border-zinc-200 bg-zinc-100"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(circle_at_50%_20%,rgba(255,255,255,0.95),rgba(244,244,245,0)_70%)]"
          />
          <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="animate-in fade-in-0 text-center duration-700 motion-reduce:animate-none">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">
                Start here
              </p>
              <h2 className="mt-2 text-[30px] font-semibold tracking-tight text-zinc-950 sm:text-[38px]">
                Choose how to start.
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-pretty text-[15px] leading-7 text-zinc-600 sm:text-[16px]">
                PlanGlade is free and open source today. Start with the app, then self-host when you are ready.
              </p>
            </div>

            <article className="group relative mx-auto mt-9 max-w-2xl overflow-hidden rounded-xl border border-zinc-300 bg-white p-6 shadow-[0_1px_2px_rgba(24,24,27,0.04)] transition duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(24,24,27,0.1)] motion-reduce:transform-none motion-reduce:transition-none sm:p-8">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-zinc-100 opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none"
              />
              <div className="relative">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  One plan. No catch.
                </p>
                <h3 className="mt-3 text-[28px] font-semibold tracking-tight text-zinc-950">
                  Free. Enjoy.
                </h3>

                <div className="mt-5 flex items-end gap-2 border-b border-zinc-200 pb-6">
                  <span className="text-[52px] font-semibold leading-none tracking-[-0.055em] text-zinc-950">
                    $0
                  </span>
                  <span className="pb-1 text-[14px] text-zinc-500">/ month</span>
                </div>

                <p className="mt-6 text-[15px] leading-6 text-zinc-700">
                  Everything you need to try PlanGlade locally or self-host it.
                </p>
                <p className="mt-2 text-[13px] leading-6 text-zinc-500">
                  Self-hosted and open source under AGPL-3.0.
                </p>

                <div className="mx-auto grid max-w-md gap-3 sm:grid-cols-2 mt-6">
                  <PrimaryButton href="/login" className="w-full sm:h-11">
                    Open PlanGlade
                    <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
                  </PrimaryButton>
                  <SecondaryButton href="#self-host" className="w-full sm:h-11">
                    Learn about self-hosting
                  </SecondaryButton>
                </div>

                <ul className="mt-7 grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {startFeatures.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-[13px] leading-5 text-zinc-700"
                    >
                      <Check
                        className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500"
                        aria-hidden="true"
                      />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          </div>
        </section>

        {/* Roadmap */}
        <section id="roadmap" className="scroll-mt-16 border-b border-zinc-200 bg-zinc-50">
          <div className="mx-auto max-w-[1200px] px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="max-w-2xl">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">
                Roadmap
              </p>
              <h2 className="mt-2 text-[28px] font-semibold tracking-tight text-zinc-900 sm:text-[32px]">
                Honest about what is ready.
              </h2>
              <p className="mt-3 text-[15px] leading-7 text-zinc-600">
                PlanGlade ships a focused solo-first MVP first. Planning and
                collaboration come later, when they are genuinely useful.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <RoadmapColumn title="Available today" items={roadmapAvailable} marker="check" />
              <RoadmapColumn title="Next" items={roadmapNext} marker="arrow" />
              <RoadmapColumn title="Later" items={roadmapLater} marker="minus" />
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
                  Self-hosting uses Node.js 20+ with SQLite. Run the project
                  locally while the public release is being prepared.
                </p>
                <pre className="mt-5 overflow-x-auto rounded-md border border-zinc-200 bg-zinc-900 p-4 text-[12px] leading-6 text-zinc-100">
{`$ npm install
$ npm run dev`}
                </pre>
                <p className="mt-3 text-[12px] leading-5 text-zinc-500">
                  Self-hosting docs are being finalized before public release.
                  The in-app Settings export gives you a portable JSON copy of
                  your workspace today.
                </p>
              </div>

              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">
                  Open source
                </p>
                <h2 className="mt-2 text-[24px] font-semibold tracking-tight text-zinc-900">
                  Built in the open. Licensed under AGPL-3.0.
                </h2>
                <p className="mt-3 text-[14px] leading-6 text-zinc-600">
                  The full source will be published under AGPL-3.0. No closed
                  modules, no telemetry, no surprises. Self-hosting the app is
                  free and always will be.
                </p>
                <div className="mt-5 rounded-md border border-zinc-200 bg-zinc-50 p-4">
                  <p className="text-[12px] font-semibold uppercase tracking-wide text-zinc-500">
                    Open-source release in preparation
                  </p>
                  <p className="mt-2 text-[13px] leading-5 text-zinc-600">
                    The public repository will be linked here when the
                    open-source release is ready.
                  </p>
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
              An open-source workspace built for focused solo work. Free to run
              yourself.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <PrimaryButton href="#start">
                Get started
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" aria-hidden="true" />
              </PrimaryButton>
              <SecondaryButton href="#self-host">Read the self-host guide</SecondaryButton>
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
              <li><Link href="#open-source" className="hover:text-zinc-900">Open source</Link></li>
              <li><Link href="#self-host" className="hover:text-zinc-900">Self-host</Link></li>
              <li><Link href="#roadmap" className="hover:text-zinc-900">Roadmap</Link></li>
              <li><Link href="#faq" className="hover:text-zinc-900">FAQ</Link></li>
            </ul>
          </nav>
          <p>&copy; 2026 PlanGlade</p>
        </div>
      </footer>
    </div>
  );
}

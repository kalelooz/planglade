"use client"

import type { MouseEvent } from "react"
import { useRouter } from "next/navigation"

import HomePage from "@/app/app/page"
import CalendarPage from "@/app/app/calendar/page"
import InboxPage from "@/app/app/inbox/page"
import NotesPage from "@/app/app/notes/page"
import { ProjectsPageContent } from "@/app/app/projects/projects-page-content"
import WorkItemsPage from "@/app/app/tasks/page"
import styles from "./demo.module.css"

const DEMO_ROUTES = ["/demo/tasks", "/demo/projects", "/demo/notes", "/demo/calendar", "/demo/connections"]

function demoHref(href: string) {
  return href === "/app" ? "/demo" : href.replace(/^\/app(?=\/|\?|#|$)/, "/demo")
}

export function DemoClient({ slug }: { slug: string[] }) {
  const router = useRouter()
  const [section, id] = slug

  const keepNavigationInDemo = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const anchor = (event.target as HTMLElement).closest("a")
    if (!anchor) return
    const url = new URL(anchor.href, window.location.href)
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/app")) return
    event.preventDefault()
    router.push(demoHref(`${url.pathname}${url.search}${url.hash}`))
  }

  let page = <HomePage basePath="/demo" />
  if (section === "inbox") page = <InboxPage />
  if (section === "tasks") page = <WorkItemsPage />
  if (section === "projects") page = <ProjectsPageContent projectId={id} basePath="/demo" />
  if (section === "notes") page = <NotesPage />
  if (section === "calendar") page = <CalendarPage />

  return (
    <div className={styles.root} onClickCapture={keepNavigationInDemo} data-demo-routes={DEMO_ROUTES.join(",")}>
      {page}
    </div>
  )
}

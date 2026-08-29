import { parseCaptureInput, relativeLabel } from '@/lib/dates'

export const LANDING_DEMO_INPUT = 'Send homepage draft to Mara tomorrow #Client Refresh'

const demoProjects = ['Client Refresh']

export type DemoTask = {
  title: string
  project: string | null
  due: string | null
  state: 'Inbox'
}

function parserReadyInput(value: string) {
  return demoProjects.reduce(
    (input, project) => input.replace(`#${project}`, `#${project.replace(/\s+/g, '')}`),
    value,
  )
}

export function parseLandingDemoInput(value: string): DemoTask | null {
  const parsed = parseCaptureInput(parserReadyInput(value), demoProjects)
  const title = parsed.text.trim()
  if (!title) return null

  return {
    title,
    project: parsed.projectName,
    due: parsed.dueDate ? relativeLabel(parsed.dueDate) : null,
    state: 'Inbox',
  }
}

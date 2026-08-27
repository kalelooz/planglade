import { parseCaptureInput, relativeLabel } from '@/lib/dates'

export const LANDING_DEMO_INPUT = 'Send homepage draft to Mara tomorrow #Client Refresh'

const demoProjects = ['Client Refresh']

export type DemoTask = {
  title: string
  project: string
  due: string
  state: 'Inbox'
}

function parserReadyInput(value: string) {
  return demoProjects.reduce(
    (input, project) => input.replace(`#${project}`, `#${project.replace(/\s+/g, '')}`),
    value,
  )
}

export function parseLandingDemoInput(value: string): DemoTask {
  const parsed = parseCaptureInput(parserReadyInput(value), demoProjects)

  return {
    title: parsed.text || 'Send homepage draft to Mara',
    project: parsed.projectName ?? 'Client Refresh',
    due: parsed.dueDate ? relativeLabel(parsed.dueDate) : 'Tomorrow',
    state: 'Inbox',
  }
}
